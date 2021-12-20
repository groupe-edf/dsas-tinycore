#!/bin/sh

cd $(dirname $0)

# Force to run as root
if [ $(id -u) != 0 ]; then
  sudo -E $0 $* 
  exit $?
fi

# Get architecture
if [ `uname -m` ]; then
  arch=64
else
  arch=32
fi

# local hosts package directory
tce_dir=/mnt/sda1/tce/optional

# tiny core related
if [ "$arch" -eq "64" ]; then
  livecd_url=http://tinycorelinux.net/12.x/x86/release/Core-current.iso
  tcz_url=http://tinycorelinux.net/12.x/x86/tcz
else
  livecd_url=http://tinycorelinux.net/12.x/x86_64/release/CorePure64-current.iso
  tcz_url=http://tinycorelinux.net/12.x/x86_64/tcz
fi

# internally used dirs and paths
work=./work
tcz_dir=$work/tcz
livecd0=$work/livecd.iso
newiso=$work/newiso
src_dir=$work/src
pkg_dir=./pkg
destdir=/home/tc/dest
builddir=/home/tc/build
squashfs=$newiso/boot/core.gz
mnt=$work/mnt
image=$work/extract
build=$work/build
append=./append
dsascd=$work/dsas.iso

service_pass_len=24
rebuild=0
forcedownload=0
keep=0

# Force the umask
umask 0022

test "$SUDO_USER" && as_user="sudo -E -u $SUDO_USER" || as_user=

msg() {
    echo '[*]' $*
}

cmd() {
    echo '[cmd]' $*
    $*
}

error() {
    echo '[E]' $*
    exit 1
}

exit_if_nonroot() {
    test $(id -u) = 0 || error this script needs to run as root
}
 
pwgen() {
    pass=`< /dev/random tr -dc _A-Z-a-z-0-9 | head -c$1;echo;`
}

get_tcz() {
  mkdir -pv $tcz_dir
  for package; do
    target=$tcz_dir/$package.tcz
    dep=$target.dep
    if test ! -f $target; then
      if test -f $pkg_dir/$package.pkg; then
        (_old=$extract; extract=$build; build_pkg $package; extract=$_old)
      elif test -f $tce_dir/$package.tcz; then
        msg fetching package $package ...
        cp $tce_dir/$package.tcz $target
        if ! test -f $tce_dir/$package/tcz.dep; then
          touch $tce_dir/$package.tcz.dep
        fi
      else
        msg fetching package $package ...
        curl -o $target $tcz_url/$package.tcz
      fi
    fi

    if test ! -f $dep; then
      msg fetching dep list of $package ...
      if test -f $tce_dir/$package.tcz.dep; then
        cp $tce_dir/$package.tcz.dep $dep
      else
         curl -o $dep $tcz_url/$package.tcz.dep || touch $dep
      fi
      grep -q 404 $dep && >$dep
      if test -s $dep; then
        get_tcz $(sed -e s/.tcz$// $dep)
      fi
    fi
  done
}

install_tcz() {
    get_tcz $@
    exit_if_nonroot
    for package; do 
        target=$tcz_dir/$package.tcz
        tce_marker=$extract/usr/local/tce.installed/$package
        if ! test -f $tce_marker; then
            msg installing package $package ...
            unsquashfs -f -d $extract $target
            if test -s $tce_marker; then
                msg post-install script $package
                chroot $extract env LD_LIBRARY_PATH=/usr/local/lib /usr/local/tce.installed/$package
            else
                mkdir -p $extract/usr/local/tce.installed
                touch $tce_marker
            fi
            dep=$target.dep
            if test -s $dep; then
              install_tcz $(sed -e s/.tcz$// $dep)
            fi
        fi
    done
}

get() {
  _src=$(basename $1)
  msg "Downloading $_src"
  curl -L -o $2/$_src $1
}

download() {
  if [ $forcedownload -eq 0 ]; then
    if [ ! -f "$2/$(basename $1)" ]; then
      case $(echo $1 | sed -e "s/.*\(\..*\)$/\1/g") in
        .tgz|.tbz|.tar|.gz|.bz2) get $*; ;;
        *) error "Unknown file extension $1"; ;;
      esac
    fi
  else
    get $1 $2
  fi 
}

unpack() {
  retval=0
  case $(echo $1 | sed -e "s/.*\(\..*\)$/\1/g") in
    .tgz) tar xvzCf $2 $1; ;;
    .tbz) tar xvjCf $2 $1; ;;
    .tar) tar xvCf $2 $1; ;;
    .gz)
      if [ "${1: -7}" == ".tar.gz" ]; then
        tar xvzCf $2 $1;
      else
        error "An archive can not be a gzip"
      fi
      ;;
    .bz2) 
      if [ "${1: -8}" == ".tar.bz2" ]; then
        tar xvjCf $2 $1;
      else
        error "An archive can not be a bzip2"
      fi
      ;;
    *)
      error "Unknown file extension $1"
      retval=1
      ;;
  esac
}

build_pkg() {
  for pkg in $1; do
    pkg_file=$pkg_dir/$pkg.pkg
    if [ $rebuild -eq "1" ] || [ ! -f "$tcz_dir/$pkg.tcz" ]; then
      if [ -f "$pkg_file" ]; then
        msg "Building $pkg_file"
        . $pkg_file
        _src=$(basename $_uri)
        for dep in $_build_dep; do
          # () needed to create new environment 
          (build_pkg $dep) 
          [ $? -eq 0 ] || exit -1
        done
        msg "Creating build image"
        if [ -d $extract ]; then
          rm -fr $extract
        fi
        mkdir -p $extract
        zcat $squashfs | { cd $extract; cpio -i -H newc -d; }

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
        msg "Building $_pkg.tcz"
        mkdir -p $src_dir
        download $_uri $src_dir
        mkdir -p $extract/home/tc
        chown tc.staff $extract/home/tc
        $as_user mkdir -p $extract/$builddir
        $as_user mkdir -p $extract/$destdir
        unpack $src_dir/$_src $extract/$builddir
        chown -R $SUDO_USER $extract/$builddir

        cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
$_pre_config
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [ -z "$_pre_config" ] || chroot $extract /tmp/script || { error "Unexpected error ($?) in configuration"; exit 1; }


        msg "Configuring $_pkg"
        cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
cd $builddir/$_pkg_path
$_conf_cmd
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [ -z "$_conf_cmd" ] || chroot --userspec=$SUDO_USER $extract /tmp/script || { error "Unexpected error ($?) in configuration"; exit 1; }
        msg "Building $_pkg"
        cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
cd $builddir/$_pkg_path
$_make_cmd
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [ -z "$_make_cmd" ] || chroot --userspec=$SUDO_USER $extract /tmp/script $_make_cmd || { error "Unexpected error ($?) in build"; exit 1; }
        msg "Installing $_pkg"
        cat << EOF > $extract/tmp/script
export DESTDIR=$destdir
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
cd $builddir/$_pkg_path
$_install_cmd$destdir
exit \$?
EOF
        chmod a+x $extract/tmp/script
        [  -z "$_install_cmd" ] || chroot $extract /tmp/script || { error "Unexpected error ($?) in install"; exit 1; }
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
        [ -z "$_post_build" ] || { msg "Post build script"; chroot $extract /tmp/script; } || { error "Unexpected error ($?) in post build"; exit 1; }
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
  test -f $livecd0 || cmd curl -o $livecd0 $livecd_url
  mkdir -pv $mnt
  if ! ls $squashfs >/dev/null 2> /dev/null; then
    msg Unpacking the ISO $livecd_url
    mount | grep $livecd0 > /dev/null || cmd mount $livecd0 $mnt
    cmd rsync -av --exclude=boot.cat $mnt/ $newiso/
    cmd umount $mnt
  fi
}

case $1 in
-clean)
  rm -fr $image $build $newiso $mnt $dsascd $dsascd.md5 $work/dsas_pass.txt
  exit 0
  ;;
-realclean)
  rm -fr $work
  exit 0
  ;;
-b|-build)
  shift
  extract=$build
  pkgs=""
  newargs=""
  while [ "$#" -gt 0 ]; do
    case $1 in
      -r|--rebuild) rebuild=1; newargs="$newargs $1" ;;
      -f|--download) forcedownload=1; newargs="$newargs $1" ;;
      -k|--keep) keep=1; ;;
      *) pkgs="$pkgs $1"
    esac
    shift
  done

  mkdir -p $work
  get_unpack_livecd

  [ -d $extract ] || mkdir -p $extract
  [ -d $build_dir ] || mkdir -p $build_dir
  [ -d $destdir ] || mkdir -p $destdir
  [ -z $pkgs ] && $(echo "No package to build given"; exit 1) 
  build_pkg $pkgs
  exit 0
  ;;
*)
  extract=$image

  # Get the ISO
  mkdir -p $work
  get_unpack_livecd

  # Unpack squashfs
  if ! ls $extract/proc > /dev/null 2> /dev/null; then
    cmd mkdir -p $extract
    zcat $squashfs | { cd $extract; cpio -i -H newc -d; }
  fi

  # Install the needed packages
  install_tcz openssl-1.1.1  # explicitly install openssl first so avail to ca-certificate
  install_tcz lftp 
  install_tcz kmaps
  install_tcz openssh
  install_tcz sshpass
  install_tcz coreutils     # For sha256, etc
  install_tcz osslsigncode
  install_tcz libxml2-bin   # For xmllint
  install_tcz gnupg
  install_tcz gdbm          # Needed for sasl
  install_tcz cyrus-sasl-lite
  install_tcz lighttpd
  install_tcz php-8.0-cgi
  install_tcz php-8.0-ext
  install_tcz pcre2
  install_tcz dialog
  install_tcz rpm
  install_tcz p7zip         # Needed by LiveUpdate
  install_tcz zip-unzip     # Needed to allow repacking of unsigned zip files
  install_tcz clamav

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


  # customize boot screen
  rsync -rv ./boot/ $newiso/boot/

  msg creating $dsascd
  tmp=$work/squashfs.gz
  ( cd $extract; find | cpio -o -H newc; ) | gzip -2 > $squashfs
  mkisofs=$(which mkisofs genisoimage | head -n 1)
  cmd $mkisofs -l -J -R -V TC-custom -no-emul-boot -boot-load-size 4 \
    -boot-info-table -b boot/isolinux/isolinux.bin \
    -c boot/isolinux/boot.cat -o $dsascd $newiso
  msg creating $dsascd.md5
  (cd $work; md5sum `basename $dsascd`; ) > $dsascd.md5

  if [ "$1" != "-keep" ]; then
    rm -fr $image $newiso $mnt
  fi
  exit 0
  ;;
esac


