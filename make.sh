#!/bin/sh
#
# shellcheck shell=sh
# shellcheck disable=SC2039
# global _build_dep _conf_cmd _dep _install_cmd _make_cmd _pkg _pkg_path _pkgs
# global _post_build _post_install _pre_config _uri _version

# If not running as root and/or running /bin/dash restart as root with a compatible shell
readlink /proc/$$/exe | grep -q dash && _shell="/bin/bash"
[ "$(id -u)" -ne 0 ] && _asroot="sudo -E"
if [ -n "$_shell" ]; then
  $_asroot $_shell "$0" "$@"
  exit $?
elif [ -n "$_asroot" ]; then
  $_asroot "$0" "$@"
  exit $?
fi

# Set LANG so that perl doesn't complain
LANG="C"

# Get default architecture
arch="32"
[ "$(uname -m)" == "x86_64" ] && arch="64"

# Parse commandline args
rebuild=0
forcedownload=0
keep=0
testcode=0
cmd=""
pkgs=""
while [ "$#" -gt 0 ]; do
  case $1 in

    -r|--rebuild) rebuild=1;  ;;
    -f|--download) forcedownload=1; ;;
    -k|--keep) keep=1; ;;
    -t|--test) testcode=1; ;;
    -32) arch="32"; ;;
    -64) arch="64"; ;;
    -h|--help)
      echo "Usage: $(basename "$0")  [Options] [Command]"
      echo "Build DSAS packages and distributions. Valid commands are"
      echo "     build pkg       Build the package 'pkg' from source code"
      echo "     source          Package DSAS source code"
      echo "     docker          Build a docker distribution package"
      echo "     clean           Remove the distribution files"
      echo "     realclean       Remove all files, leaving a clean build tree"
      echo "     check           Run test code to test correct function of checkfiles" 
      echo "     iso             Build the DSAS ISO file. This the default command"
      echo "     static          Run static analysis on the DSAS source code"
      echo "Valid options are"
      echo "     -r|--rebuild    Force the rebuild of source packages"
      echo "     -f|--download   Force the source packages to be re-downloaded"
      echo "     -t|--test       Include test code in DSAS build"
      echo "     -k|--keep       Keep intermediate build files for debugging"
      echo "     -32             Force the build for 32 bit architectures"
      echo "     -64             Force the build for 64 bit architectures"
      echo "     -h|--help       Print this help"
      exit 0
      ;;
    *)
      if [ -z "$cmd" ]; then
        cmd=$1
      else
        pkgs="$pkgs $1"
      fi
      ;;
  esac
  shift
done

# local hosts package directory on Tinycore for package reuse if possible
[ "$arch" == 64 ] && [ "$(uname -m)" == "x86_64" ] && \
  [ -d "/etc/sysconfig/tcedir/optional" ] && tce_dir="/etc/sysconfig/tcedir/optional"
[ "$arch" == 32 ] && [ "$(uname -m)" == "i686" ] && \
  [ -d "/etc/sysconfig/tcedir/optional" ] && tce_dir="/etc/sysconfig/tcedir/optional"

# Can't build 64-bit DSAS on 32-bit host
[ "$arch" == 64 ] && [ "$(uname -m)" == "i686" ] && { echo "Can not build 64-bit DSAS on 32-bit host"; exit 1; }

# Longer curl timeout
curl_cmd="curl --connect-timeout 300"

# tiny core related
if [ "$arch" != "64" ]; then
  livecd_url=http://tinycorelinux.net/13.x/x86/release/Core-current.iso
  tcz_url=http://tinycorelinux.net/13.x/x86/tcz
  tcz_src=http://tinycorelinux.net/13.x/x86/release/src
else
  livecd_url=http://tinycorelinux.net/13.x/x86_64/release/CorePure64-current.iso
  tcz_url=http://tinycorelinux.net/13.x/x86_64/tcz
  tcz_src=http://tinycorelinux.net/13.x/x86_64/release/src
fi
export tcz_src

# internally used dirs and paths
work=./work
tcz_dir=$work/tcz$arch
livecd0=$work/livecd$arch.iso
newiso=$work/newiso
src_dir=$work/src
pkg_dir=./pkg
destdir=/home/tc/dest
builddir=/home/tc/build
if [ "$arch" != "64" ]; then
  squashfs=$newiso/boot/core.gz
else
  squashfs=$newiso/boot/corepure64.gz
fi
mnt=$work/mnt
image=$work/extract
build=$work/build
append=./append
dsascd=$work/dsas.iso
rootfs64=$work/rootfs64
docker=$work/docker
dockimage=$work/docker.tgz
source=$work/dsas.tgz
service_pass_len=24

# Force the umask
umask 0022

msg() {
    echo "[*]" "$@"
}

cmd() {
    echo "[cmd]" "$@"
    "$@"
}

error() {
    echo "[E]" "$@"
    exit 1
}

exit_if_nonroot() {
    test "$(id -u)" = 0 || error this script needs to run as root
}
 
pwgen() {
    pass=$(< /dev/random tr -dc _A-Z-a-z-0-9 | head -c "$1"; echo;)
}

get_tcz() {
  mkdir -pv $tcz_dir
  for package; do
    target=$tcz_dir/$package.tcz
    dep=$target.dep
    if test ! -f "$target"; then
      if test -f "$pkg_dir/$package.pkg"; then
        # shellcheck disable=SC2030
        (_old="$extract"; extract="$build"; build_pkg "$package"; extract="$_old" )
      elif test -f "$tce_dir/$package.tcz"; then
        msg "fetching package $package ..."
        cp "$tce_dir/$package.tcz" "$target"
        if ! test -f "$tce_dir/$package/tcz.dep"; then
          touch "$tce_dir/$package.tcz.dep"
        fi
      else
        msg "fetching package $package ..."
        $curl_cmd -o "$target" "$tcz_url/$package.tcz" || exit 1
      fi
    fi
    if test ! -f "$dep"; then
      msg "fetching dep list of $package ..."
      if test -f "$tce_dir/$package.tcz.dep"; then
        cp "$tce_dir/$package.tcz.dep" "$dep"
      else
         $curl_cmd -o "$dep" "$tcz_url/$package.tcz.dep" || touch $dep
      fi
      grep -q 404 "$dep" || get_tcz $(sed -e s/.tcz$// "$dep")
    fi
  done
}

install_tcz() {
    get_tcz $@
    exit_if_nonroot
    for package; do 
        target=$tcz_dir/$package.tcz
        tce_marker=$extract/usr/local/tce.installed/$package
        if ! test -f "$tce_marker"; then
            msg "installing package $package ..."
            unsquashfs -f -d "$extract" "$target"
            if test -s "$tce_marker"; then
                msg "post-install script $package"
                chroot "$extract" env LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib "/usr/local/tce.installed/$package"
            else
                mkdir -p "$extract/usr/local/tce.installed"
                touch "$tce_marker"
            fi
            dep=$target.dep
            if test -s "$dep"; then
              install_tcz $(sed -e s/.tcz$// "$dep")
            fi
        fi  
    done
}

get() {
  _src=$(basename "$1")
  msg "Downloading $_src"
  $curl_cmd -L -o "$2/$_src" "$1" || exit 1
}

download() {
  if [ "$forcedownload" -eq 0 ]; then
    if [ ! -f "$2/$(basename "$1")" ]; then
      case $(echo "$1" | sed -e "s/.*\(\..*\)$/\1/g") in
        .tgz|.tbz|.tar|.gz|.bz2|.xz) get "$@"; ;;
        *) error "Unknown file extension $1"; ;;
      esac
    fi
  else
    get "$1" "$2"
  fi 
}

unpack() {
  case $(echo "$1" | sed -e "s/.*\(\..*\)$/\1/g") in
    .tgz) tar xvzCf "$2" "$1"; ;;
    .tbz) tar xvjCf "$2" "$1"; ;;
    .tar) tar xvCf "$2" "$1"; ;;
    .gz)
      if [ "${1: -7}" == ".tar.gz" ]; then
        tar xvzCf "$2" "$1";
      else
        error "An archive can not be a gzip"
      fi
      ;;
    .bz2) 
      if [ "${1: -8}" == ".tar.bz2" ]; then
        tar xvjCf "$2" "$1";
      else
        error "An archive can not be a bzip2"
      fi
      ;;
    .xz)
      if [ "${1: -7}" == ".tar.xz" ]; then
        tar xvJCf "$2" "$1";
      else
        error "An archive can not be a xz"
      fi
      ;;
    *)
      error "Unknown file extension $1"
      ;;
  esac
}

build_pkg() {
  for pkg in $1; do
    pkg_file=$pkg_dir/${pkg%%-dev}.pkg
    if [ ! -f "$tcz_dir/$pkg.tcz" ] || { [ $rebuild -eq "1" ]  &&  \
        [ "$startdate" -gt "$(date -r "$tcz_dir/$pkg.tcz" +%s)" ]; } then
      if [ -f "$pkg_file" ]; then
        msg "Building $pkg_file"
        # Unset build variables before sourcing package file
        unset _build_dep _conf_cmd _dep _install_cmd _make_cmd _pkg _pkg_path _pkgs \
          _post_build _post_install _pre_config _uri _version
        . "$pkg_file"
        _src=$(basename "$_uri")
        for dep in $_build_dep; do
          # () needed to create new environment 
          (build_pkg "$dep") || error "Building package $dep" 
        done
        msg "Creating build image"
        #if [ -d $extract ]; then
        #  umount $extract/proc
        #  rm -fr $extract
        #fi
        mkdir -p $extract
        zcat $squashfs | { cd $extract; cpio -i -H newc -d; }
        mount -t proc /proc $extract/proc

        # FIXME : Fix missing links
        # It appears that certain links are missings with the base intsall
        # and they need to be forced
        ( cd $extract/usr/lib; ln -s ../../lib/libpthread.so.0 libpthread.so; )
        ( cd $extract/usr/lib; ln -s ../../lib/libdl.so.2 libdl.so; )   

        # Force install of coreutils as always needed for install_tcz
        install_tcz coreutils
        for dep in $_build_dep; do
          install_tcz $dep
        done

        # Copy /etc/resolv.conf file 
        mkdir -p $extract/etc
        cp -p /etc/resolv.conf $extract/etc/resolv.conf

        msg "Building $_pkg.tcz"
        mkdir -p $src_dir
        download $_uri $src_dir
        mkdir -p $extract/home/tc

        mkdir -p $extract/$builddir
        mkdir -p $extract/$destdir
        unpack $src_dir/$_src $extract/$builddir
        chroot $extract chown -R tc.staff /home/tc
        cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
$_pre_config
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [ -z "$_pre_config" ] || chroot $extract /tmp/script || { umount $extract/proc; error "Unexpected error ($?) in configuration"; }


        msg "Configuring $_pkg"
        cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
cd $builddir/$_pkg_path
$_conf_cmd
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [ -z "$_conf_cmd" ] || chroot --userspec=tc $extract /tmp/script || { umount $extract/proc; error "Unexpected error ($?) in configuration"; }
        msg "Building $_pkg"
        cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
cd $builddir/$_pkg_path
$_make_cmd
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [ -z "$_make_cmd" ] || chroot --userspec=tc $extract /tmp/script $_make_cmd || { umount $extract/proc; error "Unexpected error ($?) in build"; }
        msg "Installing $_pkg"
        cat << EOF > $extract/tmp/script
export DESTDIR=$destdir
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
cd $builddir/$_pkg_path
$_install_cmd$destdir
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [  -z "$_install_cmd" ] || chroot $extract /tmp/script || { umount $extract/proc; error "Unexpected error ($?) in install"; }
        cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
destdir=$destdir
builddir=$builddir
_pkg_path=$_pkg_path
cd $destdir
$_post_build
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [ -z "$_post_build" ] || { msg "Post build script"; chroot $extract /tmp/script; } || { umount $extract/proc; error "Unexpected error ($?) in post build"; }
        # Create post-install script if needed
        if [ -n "$_post_install" ]; then 
          msg "Creating post install script"
          mkdir -p $extract$destdir/usr/local/tce.installed
          echo "$_post_install" > $extract$destdir/usr/local/tce.installed/$_pkg
          chmod 755 $extract$destdir/usr/local/tce.installed/$_pkg
        fi

        # Create the pkgname and shell escaped list of directories/files and then make TCZ 
        OIFS=$IFS
        IFS=";"
        [ -z "$_pkg" ] && _pkg="main{.}"
        for arg in $_pkgs; do
          pkg=$(echo "$arg" | sed -e "s/{.*$//" | awk '{$1=$1};1')
          IFS=","
          dirs=""
          set -o noglob
          for _dir in $(echo "$arg" | sed -e 's/^.*{\(.*\)}$/\1/');  do
            dirs="$dirs $(echo $_dir | sed -e 's:^/::')"
          done
          set +o noglob
          IFS=$OIFS
          if [ "$pkg" == "main" ]; then
            tcz=$_pkg.tcz
            [ -z "$_post_install" ] || dirs="$dirs usr/local/tce.installed"
          else
            tcz=$_pkg-$pkg.tcz
          fi
          msg "Creating $tcz"
          [ -f $tcz_dir/$tcz ] && rm $tcz_dir/$tcz
          tempdir=$(mktemp -d)
          chmod 755 $tempdir
          (cd $extract$destdir; tar -cf - $dirs | tar -C $tempdir -x -f -) 
          mksquashfs $tempdir $tcz_dir/$tcz
          rm -fr $tempdir
          cat $tcz_dir/$tcz | md5sum | sed -e "s/ -$//g" > $tcz_dir/$tcz.md5.txt
          if [ "$pkg" == "main" ]; then
            echo -n "" > $tcz_dir/$tcz.dep
            for dep in $_dep; do
              echo -n -e "$dep\n" >> $tcz_dir/$tcz.dep
            done
          else
            echo "$_pkg" > $tcz_dir/$tcz.dep
          fi
          IFS=";"
        done
        IFS=$OIFS
        umount $extract/proc
        if [ "$keep" == "0" ]; then
          msg "Removing build image"
          if [ -d $extract ]; then 
            rm -fr $extract
          fi
        fi

      else
        # Can't rebuild package try getting the tcz
        _old="$extract"
        extract="$build"
        get_tcz $pkg
        extract="$_old"
      fi
    fi
  done
}

get_unpack_livecd(){
  test -f $livecd0 || msg Downloading $livecd_url
  test -f $livecd0 || cmd $curl_cmd -o $livecd0 $livecd_url || exit 1
  mkdir -pv $mnt
  if ! ls $squashfs >/dev/null 2> /dev/null; then
    msg Unpacking the ISO $livecd_url
    mount | grep $livecd0 > /dev/null || cmd mount $livecd0 $mnt
    cmd rsync -av --exclude=boot.cat $mnt/ $newiso/
    cmd umount $mnt
  fi
}

startdate=$(date +%s)

case $cmd in
source)
  tar cvzf $source --exclude=work --exclude=.git .
  exit 0
  ;;
clean)
  rm -fr $image $build $newiso $mnt $dsascd $rootfs64 $dsascd.md5 \
      $docker $dockimage $source $work/dsas_pass.txt
  exit 0
  ;;
realclean)
  rm -fr $work
  exit 0
  ;;
check)
  error "Self test are not written yet"
  exit 1
  ;;
static)
  if [ -x "vendor/bin/phpstan" ]; then
    vendor/bin/phpstan
  else
    msg "### Install phpstan via composer before continuing"
  fi
  if which eslint> /dev/null 2>&1; then
    eslint $append/usr/local/share/www/dsas.js
  else
    msg "### Install eslint before continuing"
  fi
  if which shellcheck > /dev/null 2>&1; then
    shellcheck -x $append/usr/local/sbin/* \
                  $append/etc/init.d/services/dsas \
                  $append/etc/init.d/rcS.docker \
                  make.sh
  else
    msg "### Install shellcheck before continuing"
  fi
  ;;
build)
  shift
  extract=$build
  mkdir -p $work
  get_unpack_livecd

  [ -d $extract ] || mkdir -p $extract
  [ -d $build_dir ] || mkdir -p $build_dir
  [ -z $pkgs ] && error "No package to build given"
  build_pkg $pkgs
  exit 0
  ;;
docker)
  # Force build of the ISO
  shift
  [ -f "$dsascd" ] || $0 $*
  
  # Repack the disk image
  mkdir -p $newiso
  mount $dsascd $newiso
  extract=$rootfs64
  msg "Extracting DSAS files"
  rm -fr $extract
  mkdir -p $extract
  zcat $squashfs | { cd $extract; cpio -i -H newc -d; }
  umount $newiso
  msg "Setting up DSAS for docker"
  install_tcz squashfs-tools
  cat docker/tce-load.patch | (cd $extract; patch usr/bin/tce-load; )
  echo -n tc > $extract/etc/sysconfig/tcuser
  msg "Compressing DSAS files"  
  mkdir -p $docker
  tar -czC $extract -f $docker/rootfs64.tar.gz .
  msg "Creating docker install package in $dockimage"
  cp -pr docker/Makefile docker/Dockerfile $docker
  tar -czC $docker -f $dockimage .
  if [ "$keep" == "0" ]; then
    rm -fr $newiso $extract $docker
  fi
  exit 0  
  ;;
""|iso)
  extract=$image

  # Get the ISO
  mkdir -p $work
  get_unpack_livecd

  # Unpack squashfs
  if ! ls $extract/proc > /dev/null 2> /dev/null; then
    cmd mkdir -p $extract
    zcat $squashfs | { cd $extract; cpio -i -H newc -d; }
  fi

  # FIXME
  # We have a chicken and the egg problem with busybox. Our custom built busybox 
  # depends en /lib/libtirpc.3 that needs to be linked to /usr/local/lib/libtirpc.3
  # The libtirpc doesn't do this, and it can't created in the post install script of 
  # busybox because the toolchain is broken at that point. So we need to install libtirpc
  # first and manually created the link
  install_tcz libtirpc
  chroot $extract /bin/ln -s /usr/local/lib/libtirpc.so.3 /lib/libtirpc.so.3
  

  # Install the needed packages
  install_tcz busybox  # Busybox with PAM and TMOUT support
  install_tcz openssl-1.1.1  # explicitly install openssl first so avail to ca-certificate
  install_tcz kmaps
  install_tcz openssh
  install_tcz sshpass
  install_tcz coreutils     # For sha256, etc
  install_tcz osslsigncode
  install_tcz libxml2-bin   # For xmllint
  install_tcz gnupg
  install_tcz lighttpd
  install_tcz php-8.0-cgi
  install_tcz php-8.0-ext
  install_tcz php-pam
  install_tcz pcre2
  install_tcz dialog
  install_tcz rpm
  install_tcz p7zip         # Needed by LiveUpdate
  install_tcz zip-unzip     # Needed to allow repacking of unsigned zip files
  install_tcz clamav
  install_tcz Linux-PAM
  install_tcz net-snmp
  install_tcz lftp
  install_tcz libpam-radius-auth

  if [ "$testcode" == "1" ]; then
    install_tcz freeradius
    install_tcz rsyslog
  fi

  # Copy the pre-extracted packages to work dir. This must be after packages
  # are installed to allow for files to be overwritten. Run as root 
  # and correct the ownership of files 
  msg append dsas files
  rsync -rlptv $append/ $extract/
  mkdir -p $extract/home/tc
  chown root.root $extract
  chmod 755 $extract/home

  # prevent autologin of tc user
  ( cd $extract/etc; sed -i -r 's/(.*getty)(.*autologin)(.*)/\1\3/g'  inittab; )

  # Create users
  passfile=$work/dsas_pass.txt
  cp /dev/null $passfile
  chmod 700 $passfile

  create_users=$extract/tmp/create_users.sh
  cp /dev/null $create_users

  msg WARNING: Change default password for 'tc' user and run 'filetool.sh -b'
  echo tc:dSaO2021DSAS >> $passfile
cat << EOF >> $create_users
echo tc:dSaO2021DSAS | chpasswd -c sha512
mkdir /home/tc/.ssh
chmod 700 /home/tc/.ssh
chown tc.staff /home/tc/.ssh
EOF

  msg adding user 'verif'
  pwgen $service_pass_len
  echo "verif:$pass" >> $passfile
  cat << EOF >> $create_users
adduser -s /bin/false -u 2000 -D -h /home/verif verif
echo verif:$pass | chpasswd -c sha512
EOF

  msg adding user 'bas'
  pwgen $service_pass_len
  echo "bas:$pass" >> $passfile
  cat << EOF >> $create_users
adduser -s /bin/false -u 2001 -D -h /home/bas bas
echo bas:$pass | chpasswd -c sha512
mkdir /home/bas/.ssh
chmod 700 /home/bas/.ssh
chown bas.bas /home/bas/.ssh
EOF

  msg adding user 'haut'
  pwgen $service_pass_len
  echo "haut:$pass" >> $passfile
  cat << EOF >> $create_users
adduser -s /bin/false -u 2002 -D -h /home/haut haut
echo bas:$pass | chpasswd -c sha512
mkdir /home/haut/.ssh
chmod 700 /home/haut/.ssh
chown haut.haut /home/haut/.ssh
EOF

  cat << EOF >> $create_users
addgroup verif bas
addgroup verif haut
addgroup tc verif
addgroup -g 2003 share
addgroup verif share
addgroup bas share
addgroup haut share
addgroup -g 2004 repo
addgroup bas repo
addgroup tc repo
addgroup -g 51 users

# Hardening
# Fix directory and file permissions
chmod 440 /etc/sudoers
chmod 700 /root
chmod -R g-s /home
chown -R tc.staff /home/tc
chmod -R o-rwx /home/tc /home/haut /home/bas /home/verif 
chown -R root.staff /var/dsas
chmod 775 /var/dsas          # Write perm for verif
chmod 640 /var/dsas/*.csr /var/dsas/*.pem
chown tc.repo /var/dsas/*.csr /var/dsas/*.pem
chmod 664 /var/dsas/dsas_conf.xml
chown tc.staff /var/dsas/dsas_conf.xml
chown -R root.staff /opt
chmod 770 /opt
chmod 770 /opt/.filetool.lst
chmod 644 /usr/local/share/www/* /usr/local/share/www/api/* /usr/local/share/www/en/* /usr/local/share/www/fr/*
chmod 755 /usr/local/share/www/en /usr/local/share/www/fr /usr/local/share/www/api
sed -i "s/umask 0[0-7][0-7]/umask 027/" /etc/profile
echo "
# Forbid core dumps
ulimit -c 0" >> /etc/profile

EOF

  chmod 755 $create_users
  chroot $extract /tmp/create_users.sh
  rm $create_users

  # Special case, very limited busybox for chroot with only /bin/ash and /usr/bin/env installed
  _old=$extract
  extract=$extract/opt/lftp
  install_tcz ash
  extract=$_old

  # Install lftp and dependencies in /opt so that they can be available in chroot jail
  # Install missing libraries. Don't use harlink to avoid possible chroot breakout
  cat << EOF > $extract/tmp/script
#! /bin/sh
  export LD_LIBRARY_PATH=/usr/lib:/lib:/usr/local/lib
  _ldir=/opt/lftp
  (umask 022; mkdir -p \$_ldir/lib \$_ldir/dev \$_ldir/etc \$_ldir/tmp \$_ldir/home)
  chmod 775 \$_ldir/tmp
  chown root.staff \$_ldir/tmp
  (umask 027; mkdir -p \$_ldir/home/haut)
  chown haut.haut \$_ldir/home/haut
  cp -p /lib/ld-linux* \$_ldir/lib
  grep ^haut /etc/passwd > \$_ldir/etc/passwd
  cp -p /etc/host.conf /etc/nsswitch.conf \$_ldir/etc
  for _file in /usr/local/bin/lftp /usr/local/etc/lftp.conf /usr/local/bin/ssh; do
    while [ -L "\$_file" ]; do
      _link=\$(readlink "\$_file")
      _d=\$(dirname "\$_ldir/\$_file")
      [ -d "\$_d" ] || (umask 022; mkdir -p \$_d)
      1>&2 echo "  [-] Linking \$_ldir/\$_file to \$_link"
      ln -s "\$_link" "\$_ldir/\$_file"
      if [ "\$(dirname \$_link)" == "." ]; then
        _file="\$(dirname \$_file)/\$_link"
      else
        _file=\$_link
      fi
    done
    1>&2 echo "  [-] Copying \$_file to \$_ldir/\$_file"
    [ -d "\$(dirname "\$_ldir/\$_file")" ] || (umask 022; mkdir -p "\$(dirname "\$_ldir/\$_file")")
    cp -p "\$_file" "\$_ldir/\$_file"
    ldd \$_file 2> /dev/null | while read -r _line; do
      _l2=\$(echo \$_line | cut -d\\> -f2)
      [ "\$_line" == "\$_l2" ] && continue
      _lib=\$(echo \$_l2 | cut -d\\( -f1 | xargs)
      [ -e "\$_ldir/\$_lib" ] && continue
      [ -e "\$_lib" ] || { 1>&2 echo "    [E] library XX\${_lib}XX not found"; exit 1; }
      _lfile=\$_lib
      while [ -L "\$_lfile" ]; do
        _link=\$(readlink "\$_lfile")
        _d=\$(dirname \$_ldir/\$_lfile)
        [ -d "\$_d" ] || (umask 022; mkdir -p \$_d)
        1>&2 echo "    [-] Linking \$_ldir/\$_lfile to \$_link"
        ln -s "\$_link" "\$_ldir/\$_lfile"
        if [ "\$(dirname \$_link)" == "." ]; then
          _lfile="\$(dirname \$_lfile)/\$_link"
        else
          _lfile=\$_link
        fi
      done
      1>&2 echo "    [-] Copying \$_lfile to \$_ldir/\$_lfile"
      [ -d "\$(dirname "\$_ldir/\$_lfile")" ] || (umask 022; mkdir -p "\$(dirname "\$_ldir/\$_lfile")")
      cp -p "\$_lfile"  "\$_ldir/\$_lfile"
    done
  done
  exit \$?
EOF
  chmod a+x $extract/tmp/script
  { msg "Setting up lftp chroot jail"; chroot $extract /tmp/script; } || { error "Unexpected error ($?) in lftp chroot creation"; exit 1; }
  /bin/rm -f $extract/tmp/script
  mknod -m=666 $extract/opt/lftp/dev/null c 1 3
  (cd $extract/opt/lftp/dev/; ln -s pts/ptmx)

  # Add console timeout to all .profile files
  for file in $(find $extract -name ".profile"); do
    echo "export TMOUT=300" >> $file
  done

  # customize boot screen
  cp -p ./boot/isolinux/boot.msg $newiso/boot/
  if [ "$arch" != "64" ]; then
    cp -p ./boot/isolinux/isolinux.cfg $newiso/boot/isolinux
  else
    cp -p ./boot/isolinux/isolinux64.cfg $newiso/boot/isolinux/isolinux.cfg
  fi

  msg creating $dsascd
  tmp=$work/squashfs.gz
  ( cd $extract; find | cpio -o -H newc; ) | gzip -2 > $squashfs
  mkisofs=$(which mkisofs genisoimage | head -n 1)
  cmd $mkisofs -l -J -R -V TC-custom -no-emul-boot -boot-load-size 4 \
    -boot-info-table -b boot/isolinux/isolinux.bin \
    -c boot/isolinux/boot.cat -o $dsascd $newiso
  msg creating $dsascd.md5
  (cd $work; md5sum `basename $dsascd`; ) > $dsascd.md5

  if [ "$keep" == "0" ]; then
    rm -fr $image $newiso $mnt
  fi
  exit 0
  ;;
*)
  echo "Invalid command $cmd"
  exit 1
esac


