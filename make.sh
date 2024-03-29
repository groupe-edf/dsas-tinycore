#!/bin/sh
#    DSAS - Tinycore
#    Copyright (C) 2021-2022  Electricite de France
#
#    This program is free software; you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation; either version 2 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License along
#    with this program; if not, write to the Free Software Foundation, Inc.,
#    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
#
# Shellcheck configuration to test for POSIX shell plus the Busybox/ASH extensions I use
# Allow process subsitution with "<()"
# shellcheck disable=SC3001
# Allow echo flags
# shellcheck disable=SC3037
# Allow "read -d"
# shellcheck disable=SC3045
# Allow string indexing like "${1:3}"
# shellcheck disable=SC3057

# If not running as root and/or running /bin/dash restart as root with a compatible shell
readlink /proc/$$/exe | grep -q dash && _shell="/bin/bash"
[ "$(id -u)" -ne 0 ] && _asroot="sudo -E"
if [ -n "$_shell" ]; then
  $_asroot "$_shell" "$0" "$@"
  exit $?
elif [ -n "$_asroot" ]; then
  $_asroot "$0" "$@"
  exit $?
fi

# Set LANG so that perl doesn't complain
LANG="C"

# Get default architecture
arch="32"
[ "$(uname -m)" = "x86_64" ] && arch="64"

# Parse commandline args
rebuild=0
forcedownload=0
keep=0
testcode=0
vmtools=0
cmd=""
pkgs=""
while [ "$#" -gt 0 ]; do
  case $1 in

    -r|--rebuild) rebuild=1; ;;
    -f|--download) forcedownload=1; ;;
    -k|--keep) keep=1; ;;
    -t|--test) testcode=1; ;;
    -v|--vmtools) vmtools=1; ;;
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
      echo "     upgrade         Upgrade the TCZ packages to their latest version"
      echo "     work            Set the work directory"
      echo "Valid options are"
      echo "     -r|--rebuild    Force the rebuild of source packages"
      echo "     -f|--download   Force the source packages to be re-downloaded"
      echo "     -t|--test       Include test code in DSAS build"
      echo "     -k|--keep       Keep intermediate build files for debugging"
      echo "     -v|--vmtools    Install open-vm-tools in image"
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
[ "$arch" = 64 ] && [ "$(uname -m)" = "x86_64" ] && \
  [ -d "/etc/sysconfig/tcedir/optional" ] && tce_dir="/etc/sysconfig/tcedir/optional"
[ "$arch" = 32 ] && [ "$(uname -m)" = "i686" ] && \
  [ -d "/etc/sysconfig/tcedir/optional" ] && tce_dir="/etc/sysconfig/tcedir/optional"

# Can't build 64-bit DSAS on 32-bit host
[ "$arch" = 64 ] && [ "$(uname -m)" = "i686" ] && { echo "Can not build 64-bit DSAS on 32-bit host"; exit 1; }

# Longer curl timeout
curl_cmd="curl --connect-timeout 300"

# tiny core related
if [ "$arch" != "64" ]; then
  livecd_url=http://tinycorelinux.net/15.x/x86/release/Core-current.iso
  tcz_url=http://tinycorelinux.net/15.x/x86/tcz
  tcz_src=http://tinycorelinux.net/15.x/x86/release/src
else
  livecd_url=http://tinycorelinux.net/15.x/x86_64/release/CorePure64-current.iso
  tcz_url=http://tinycorelinux.net/15.x/x86_64/tcz
  tcz_src=http://tinycorelinux.net/15.x/x86_64/release/src
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
testdir=./test
dsascd=$work/dsas.iso
rootfs64=$work/rootfs64
docker=$work/docker
dockimage=$work/docker.tgz
source=$work/dsas.tgz
service_pass_len=24

# Force the umask
umask 0022

# If not on tinycore, the user "tc" doesn't exist
if grep -q "tc:" /etc/passwd; then
  tc=tc
  staff=staff
else
  tc=1001
  staff=50
fi

msg() {
    echo "[*]" "$@"
}

cmd() {
    echo "[cmd]" "$@"
    # Yes I want word-splitting here
    # shellcheck disable=SC2068
    $@
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
    package=$(echo "$package" | sed -e "s/-KERNEL/-$_kern/g")
    target=$tcz_dir/$package.tcz
    dep=$target.dep
    # If the PKG file exists and is newer than the TCZ file, rebuild 
    if test -f "$target" && test -f "$pkg_dir/$package.pkg"; then
      [ "$(stat -c '%Y' "$pkg_dir/$package.pkg")" -gt "$(stat -c '%Y' "$target")" ] && rm -f "$target"
    fi
    if test ! -f "$target"; then
      if test -f "$pkg_dir/$package.pkg"; then
        # In a new shell so that build doesn't modify local variables
        _old=$extract
        extract="$build"
        ( build_pkg "$package"; ) || exit 1
        extract="$_old"
      elif test -f "$tce_dir/$package.tcz"; then
        msg "fetching package $package ..."
        cp "$tce_dir/$package.tcz" "$target"
        if ! test -f "$tce_dir/$package/tcz.dep"; then
          touch "$tce_dir/$package.tcz.dep"
        else
          cp "$tce_dir/$package.tcz.dep" "$target"
        fi
        if ! test -f "$tce_dir/$package/tcz.md5.txt"; then
          md5sum "$tcz_dir/$package.tcz" | sed -e "s:  $tcz_dir/$package.tcz$::g" > "$tcz_dir/$package.tcz.md5.txt"
        else
          cp "$tce_dir/$package.tcz.md5.txt" "$target"
        fi
      else
        msg "fetching package $package ..."
        $curl_cmd -o "$target" "$tcz_url/$package.tcz" || exit 1
        md5sum "$tcz_dir/$package.tcz" | sed -e "s:  $tcz_dir/$package.tcz$::g" > "$tcz_dir/$package.tcz.md5.txt"
      fi
    fi
    if test ! -f "$dep"; then
      msg "fetching dep list of $package ..."
      if test -f "$tce_dir/$package.tcz.dep"; then
        cp "$tce_dir/$package.tcz.dep" "$dep"
      else
         $curl_cmd -o "$dep" "$tcz_url/$package.tcz.dep" || touch "$dep"
      fi
      grep -q 404 "$dep" && cp /dev/null "$dep"
      # Want word splitting on arg to get_tcz
      # shellcheck disable=SC2046
      get_tcz $(sed -e s/.tcz$// "$dep")
    fi
  done
}

install_tcz() {
    # Want array splitting here
    # shellcheck disable=SC2068
    get_tcz $@
    exit_if_nonroot
    for package; do
        package=$(echo "$package" | sed -e "s/-KERNEL/-$_kern/g")
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
              # Want word splitting on arg to get_tcz
              # shellcheck disable=SC2046
              install_tcz $(sed -e s/.tcz$// "$dep")
            fi
        fi  
    done
}

build_pkg_cache() {
  msg "setting up package cache dir for SNMP"
  [ "$#" -ge 1 ] && _snmpdir="$1" || _snmpdir="/var/cache/hrmib"
  _snmpdir="$extract/$_snmpdir"
  mkdir -p "$_snmpdir"
  while IFS= read -r -d '' _file; do
     _pkg=$(basename "$_file")
     if test -f "$pkg_dir/$_pkg.pkg"; then
       _version="_$(grep _version "$pkg_dir/$_pkg.pkg" | cut -d= -f2)"
     elif [ "$_pkg" = "dsas_js" ]; then
       # Special case
       _version="_$(grep "dsasVersion =" ./js/src/DsasHelp.js | sed -e "s:^.* = \"\([0-9.]*\).*$:\1:")"
     else
       [ -f "$tcz_dir/$_pkg.tcz.info" ] || $curl_cmd -s -o "$tcz_dir/$_pkg.tcz.info" "$tcz_url/$_pkg.tcz.info"
       _version=$(grep -i version: "$tcz_dir/$_pkg.tcz.info" | cut -d: -f2 | xargs | tr "/" ".")
       [ -z "$_version" ] || _version="_$_version"
     fi
     # Use amd64 for architecture for coherence with other distributions
     if [ "$arch" = "64" ]; then
       touch -r "$_file" "$_snmpdir/$_pkg${_version}_amd64"
     else
       touch -r "$_file" "$_snmpdir/$_pkg${_version}_x86" 
     fi
  done < <(find "$extract/usr/local/tce.installed" -type "f" -print0)
}

get() {
  [ "$#" -gt 2 ] && _sourc=$3
  [ "$#" -gt 2 ] || _sourc=$(basename "$1")
  msg "Downloading $_sourc"
  $curl_cmd -L -o "$2/$_sourc" "$1" || exit 1
}

download() {
  if [ "$1" = "-f" ]; then
    shift
    noext="true"
  fi
  [ "$#" -gt 2 ] && _source=$3
  [ "$#" -gt 2 ] || _source=$(basename "$1")
  if [ "$forcedownload" -eq 0 ]; then
    if [ ! -f "$2/$_source" ]; then
      if  [ "$noext" = "true" ]; then
        # Ignore extension
        get "$@"
      else
        case $(echo "$1" | sed -e "s/.*\(\..*\)$/\1/g") in
          .jar|.tgz|.tbz|.tar|.gz|.bz2|.xz) get "$@"; ;;
          *) error "Unknown file extension $1"; ;;
        esac
      fi
    fi
  else
    get "$@"
  fi 
}

unpack() {
  msg "Unpacking $1 to $2"
  case $(echo "$1" | sed -e "s/.*\(\..*\)$/\1/g") in
    .tgz) tar xzCf "$2" "$1" || return 1; ;;
    .tbz) tar xjCf "$2" "$1" || return 1; ;;
    .tar) tar xCf "$2" "$1" || return 1; ;;
    .gz)
      if [ "${1: -7}" = ".tar.gz" ]; then
        tar xzCf "$2" "$1" || return 1
      else
        error "An archive can not be a gzip"
      fi
      ;;
    .bz2) 
      if [ "${1: -8}" = ".tar.bz2" ]; then
        tar xjCf "$2" "$1" || return 1
      else
        error "An archive can not be a bzip2"
      fi
      ;;
    .xz)
      if [ "${1: -7}" = ".tar.xz" ]; then
        tar xJCf "$2" "$1" || return 1
      else
        error "An archive can not be a xz"
      fi
      ;;
    *)
      error "Unknown file extension $1"
      ;;
  esac
}

disksize(){
  _d="$1"
  while [ ! -e "$_d" ]; do _d=$(dirname "$_d"); done
  df --block-size=1G "$_d" | tail -1 | xargs | cut -d' ' -f4
}

build_pkg() {
  for pkg in $1; do
    pkg_file=$pkg_dir/${pkg%%-dev}.pkg

    # Remove old TCZ if PKG is newer
    [ -f "$pkg_file" ] && [ -f "$tcz_dir/$pkg.tcz" ] \
        && [ "$(stat -c '%Y' "$pkg_file")" -gt "$(stat -c '%Y' "$tcz_dir/$pkg.tcz")" ] \
        && rm -f "$tcz_dir/$pkg.tcz"

    # Don't rebuild if forced rebuild and TCZ date is later than the start time of the
    # build script. Prevent mutliple builds of the same package
    if [ ! -f "$tcz_dir/$pkg.tcz" ] || { [ $rebuild -eq "1" ]  &&  \
        [ "$startdate" -gt "$(date -r "$tcz_dir/$pkg.tcz" +%s)" ]; } then
      if [ -f "$pkg_file" ]; then
        msg "Building $pkg_file"
        # Unset build variables before sourcing package file
        unset _build_dep _conf_cmd _dep _install_cmd _make_cmd _pkg _pkg_path _pkgs \
          _post_build _post_install _pre_config _uri _src _version _disk_needed
        # Use Linux-PAM.pkg as a non trivial source file to test with
        # shellcheck source=pkg/Linux-PAM.pkg
        . "$pkg_file"
        [ -n "$_disk_needed" ] && [ "$(disksize "$extract")" -lt "$_disk_needed" ] && \
          error "insufficent disk for package '$pkg' (needed ${_disk_needed}GB)"
	[ -z "$_src" ] && _src=$(basename "$_uri")
        for dep in $_build_dep; do
          # () needed to create new environment 
          (build_pkg "$dep") || error "Building package $dep" 
        done
        msg "Creating build image"
        if [ -d "$extract" ]; then
          if [ -d "$extract/tmp/tcloop" ]; then
            while IFS= read -r -d '' _dir; do
              umount "$_dir"
            done < <(find "$extract/tmp/tcloop" -type "d" -print0)
          fi
          [ -d "$extract/proc" ] && [ "$(ls -A "$extract/proc")" != "" ] && umount "$extract/proc"
          rm -fr "$extract"
        fi
        mkdir -p "$extract"
        zcat "$squashfs" | { cd "$extract" || exit 1; cpio -i -H newc -d; }
        mount -t proc /proc "$extract/proc"

        # FIXME : Fix missing links
        # It appears that certain links are missings with the base intsall
        # and they need to be forced
        ( cd "$extract/usr/lib" || exit 1; [ -e "libpthread.so" ] || ln -s ../../lib/libpthread.so.0 libpthread.so; )
        ( cd "$extract/usr/lib" || exit 1; [ -e "libdl.so" ] || ln -s ../../lib/libdl.so.2 libdl.so; )   
        
        # Force install of coreutils as always needed for install_tcz
        install_tcz coreutils
        # shellcheck disable=SC2086
        install_tcz $_build_dep

        # Copy /etc/resolv.conf file 
        mkdir -p "$extract/etc"
        cp -p /etc/resolv.conf "$extract/etc/resolv.conf"

        msg "Building $_pkg.tcz"
        mkdir -p "$src_dir"
        download "$_uri" "$src_dir" "$_src"
        mkdir -p "$extract/home/tc"

        mkdir -p "$extract/$builddir"
        mkdir -p "$extract/$destdir"
        unpack "$src_dir/$_src" "$extract/$builddir" || error "Can not unpack $_src"
        chroot "$extract" chown -R ${tc}:${staff} /home/tc
        cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
export HOME=/home/tc
$_pre_config
exit \$?
EOF
        chmod a+x "$extract/tmp/script"
        [ -z "$_pre_config" ] || chroot "$extract" /tmp/script || { umount "$extract/proc"; error "Unexpected error ($?) in configuration"; }


        msg "Configuring $_pkg"
        cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
export HOME=/home/tc
cd $builddir/$_pkg_path
$_conf_cmd
exit \$?
EOF
        chmod a+x "$extract/tmp/script"
        [ -z "$_conf_cmd" ] || chroot --userspec=${tc} "$extract" /tmp/script || { umount "$extract/proc"; error "Unexpected error ($?) in configuration"; }
        msg "Building $_pkg"
        cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
export HOME=/home/tc
cd $builddir/$_pkg_path
$_make_cmd
exit \$?
EOF
        chmod a+x "$extract/tmp/script"
        [ -z "$_make_cmd" ] || chroot --userspec=${tc} "$extract" /tmp/script $_make_cmd || { umount "$extract/proc"; error "Unexpected error ($?) in build"; }
        msg "Installing $_pkg"
        cat << EOF > "$extract/tmp/script"
export DESTDIR=$destdir
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
export HOME=/home/tc
cd $builddir/$_pkg_path
$_install_cmd$destdir
exit \$?
EOF
        chmod a+x "$extract/tmp/script"
        [  -z "$_install_cmd" ] || chroot "$extract" /tmp/script || { umount "$extract/proc"; error "Unexpected error ($?) in install"; }
        cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
export HOME=/home/tc
destdir=$destdir
builddir=$builddir
_pkg_path=$_pkg_path
cd $destdir
$_post_build
exit \$?
EOF
        chmod a+x "$extract/tmp/script"
        [ -z "$_post_build" ] || { msg "Post build script"; chroot "$extract" /tmp/script; } || { umount "$extract/proc"; error "Unexpected error ($?) in post build"; }
        # Create post-install script if needed
        if [ -n "$_post_install" ]; then 
          msg "Creating post install script"
          mkdir -p "$extract$destdir/usr/local/tce.installed"
          echo "$_post_install" > "$extract$destdir/usr/local/tce.installed/$_pkg"
          chmod 755 "$extract$destdir/usr/local/tce.installed/$_pkg"
        fi

        # Create the pkgname and shell escaped list of directories/files and then make TCZ 
        OIFS=$IFS
        IFS=";"
        [ -z "$_pkgs" ] && _pkgs="main{.}"
        for arg in $_pkgs; do
          pkg=$(echo "$arg" | sed -e "s/{.*$//" | awk '{$1=$1};1')
          IFS=","
          dirs=""
          set -o noglob
          for _dir in $(echo "$arg" | sed -e 's/^.*{\(.*\)}$/\1/');  do
            dirs="$dirs $(echo "$_dir" | sed -e 's:^/::')"
          done
          set +o noglob
          IFS=$OIFS
          if [ "$pkg" = "main" ]; then
            tcz=$_pkg.tcz
            [ -z "$_post_install" ] || dirs="$dirs usr/local/tce.installed"
          else
            tcz=$_pkg-$pkg.tcz
          fi
          msg "Creating $tcz"
          [ -f "$tcz_dir/$tcz" ] && rm "$tcz_dir/$tcz"
          tempdir=$(mktemp -d)
          chmod 755 "$tempdir"
          # shellcheck disable=SC2086
          (cd "$extract$destdir" || exit 1; tar -cf - $dirs | tar -C "$tempdir" -x -f -) 
          mksquashfs "$tempdir" "$tcz_dir/$tcz"
          rm -fr "$tempdir"
          md5sum "$tcz_dir/$tcz" | sed -e "s:  $tcz_dir/$tcz$::g" > "$tcz_dir/$tcz.md5.txt"
          if [ "$pkg" = "main" ]; then
            echo -n "" > "$tcz_dir/$tcz.dep"
            for dep in $_dep; do
              echo -n -e "$dep\n" >> "$tcz_dir/$tcz.dep"
            done
          else
            echo "$_pkg" > "$tcz_dir/$tcz.dep"
          fi
          IFS=";"
        done
        IFS=$OIFS
        umount "$extract/proc"
        if [ "$keep" = "0" ]; then
          msg "Removing build image"
          if [ -d "$extract" ]; then 
            rm -fr "$extract"
          fi
        fi

      else
        # Can't rebuild package try getting the tcz
        _old="$extract"
        extract="$build"
        get_tcz "$pkg"
        extract="$_old"
      fi
    fi
  done
}

# Special version for firefox
get_tcz_and_deps() {
  _dest=$1
  shift
  for _pkg; do
    [ -f "$_dest/$_pkg.tcz" ] && continue
    msg "Copy $_pkg.tcz to $_dest"
    cp "$tcz_dir/$_pkg.tcz"  "$tcz_dir/$_pkg.tcz.dep" "$_dest"
    ( cd "$_dest" || exit 1;  md5sum "$_pkg.tcz" > "$_pkg.tcz.md5.txt"; ) || exit 1
    _dep=$tcz_dir/$_pkg.tcz.dep
    if test -s "$_dep"; then
      # Want word splitting on arg to
      # shellcheck disable=SC2046
      get_tcz_and_deps "$_dest" $(sed -e s/.tcz$// "$_dep")
    fi
  done
}

install_firefox(){
  package=firefox
  target=$tcz_dir/$package.tcz
  dep=$target.dep
  latest=firefox_getLatest
  if test ! -f "$target"; then
    if test -f "$tce_dir/$package.tcz"; then
      msg "fetching package $package ..."
      cp "$tce_dir/$package.tcz" "$target"
      if ! test -f "$tce_dir/$package/tcz.dep"; then
        touch "$tce_dir/$package.tcz.dep"
      fi
    else
      _old=$extract
      extract="$build"
      if [ -d "$extract" ]; then
        if [ -d "$extract/tmp/tcloop" ]; then
          while IFS= read -r -d '' _dir; do
            umount "$_dir"
          done < <(find "$extract/tmp/tcloop" -type "d" -print0)
        fi
        [ -d "$extract/proc" ] && [ "$(ls -A "$extract/proc")" != "" ] && umount "$extract/proc"
        rm -fr "$extract"
      fi
      mkdir -p "$extract"
      zcat "$squashfs" | { cd "$extract" || exit 1; cpio -i -H newc -d; }
      mount -t proc /proc "$extract/proc"

      # FIXME : Fix missing links
      # It appears tqhat certain links are missings with the base intsall
      # and they need to be forced
      ( cd "$extract/usr/lib" || exit 1; [ -e "libpthread.so" ] || ln -s ../../lib/libpthread.so.0 libpthread.so; )
      ( cd "$extract/usr/lib" || exit 1; [ -e "libdl.so" ] || ln -s ../../lib/libdl.so.2 libdl.so; )

      # Force install of coreutils as always needed for install_tcz
      # In seperate shell to avoid modifiying local variables
      ( install_tcz coreutils )
      ( install_tcz "$latest" )

      # Find dependencies in "$latest" and install them to allow them to be
      # cached and avoid too many downloads. sqfsTools is useds in the eval 
      # shellcheck disable=SC2034
      sqfsTools="squashfs-tools"
      # disable wierd sheelcheck warning
      # shellcheck disable=SC2046
      eval $(sed -n '/deps1="/,/"/p' $extract/usr/local/bin/$latest.sh | sed -e "s:\\\::g" -e "/^\s*else/d"  -e "/^\s*echo/d")
      mkdir -p $extract/tmp/tce/optional
      chown -R $tc:$staff $extract/tmp/tce
      chmod 775 $extract/tmp/tce $extract/tmp/tce/optional
      # deps1 is defined via the eval above. Yes I want word-splitting
      # shellcheck disable=SC2154
      # shellcheck disable=SC2086
      ( install_tcz $deps1 libssh2 )
      # Yes I want word-splitting
      # shellcheck disable=SC2086     
      ( get_tcz_and_deps  "$extract/tmp/tce/optional" $deps1 )
      chmod -R 644 "$extract/tmp/tce/optional"
      chmod 775 $extract/tmp/tce/optional
      chown -R $tc:$staff "$extract/tmp/tce/optional"

      # Copy /etc/resolv.conf file
      mkdir -p "$extract/etc"
      cp -p /etc/resolv.conf "$extract/etc/resolv.conf"

      mkdir -p "$extract/home/tc"
      chown ${tc}:${staff} "$extract/home/tc"
      echo tc > "$extract/etc/sysconfig/tcuser"

      cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
export USER=tc
sudo tce-setup
sudo update-ca-certificates
$latest.sh -e || exit 1
EOF
      chmod a+x "$extract/tmp/script"
      msg "Constructing package $package"
      HOME=/home/tc chroot --userspec=${tc} "$extract" /tmp/script || error error constructing $package

      msg "fetching package $package"
      cp "$extract/tmp/tce/optional/$package.tcz" "$target"
      if ! test -f "$extract/tmp/tce/optional/$package.tcz.dep"; then
        touch "$tce_dir/$package.tcz.dep"
      else
        cp "$extract/tmp/tce/optional/$package.tcz.dep" "$target.dep"
      fi
      md5sum "$target" | sed -e "s:  $target$::g" > "$target.md5.txt"

      if [ -d "$extract/tmp/tcloop" ]; then
        while IFS= read -r -d '' _dir; do
          umount "$_dir"
        done < <(find "$extract/tmp/tcloop" -type "d" -print0)
      fi
      [ -d "$extract/proc" ] && [ "$(ls -A "$extract/proc")" != "" ] && umount "$extract/proc"
      rm -fr "$extract"
      extract="$_old"
    fi
  fi
  install_tcz $package
}

install_webdriver(){
   package=dsaswebdriver
   target=$tcz_dir/$package.tcz
   dep=$target.dep
   if test ! -f "$target"; then
      # Install PHP composer
      download -f "https:/getcomposer.org/installer" "$src_dir" "php_composer"
      mkdir -p "$extract/home/tc"
      chown ${tc}:${staff} "$extract/home/tc"
      chmod 750 "$extract/home/tc"
      cp "$src_dir/php_composer" "$extract/home/tc"
      chmod a+rx "$extract/home/tc/php_composer"
      chroot "$extract" chown -R ${tc}:${staff} "/home/tc/"
      cp /etc/resolv.conf "$extract/etc/resolv.conf" && msg "copy resolv.conf"
      # http_proxy is imported (or not) from the environment. Shellcheck 
      # complains if we don't force a default value here
      cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
cd /home/tc
env HOME=/home/tc php php_composer || exit 1
rm php_composer
EOF
      chmod a+x "$extract/tmp/script"
      msg "Install PHP Composer $extract"
      HOME=/home/tc chroot --userspec=${tc} "$extract" /tmp/script || error composer installation failed

      # Install Facebook Webdriver
      cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
cd /home/tc
env HOME=/home/tc php composer.phar require php-webdriver/webdriver
EOF
      chmod a+x "$extract/tmp/script"
      msg "Install PHP Web driver"  
      chroot --userspec=${tc} "$extract" /tmp/script

      # Remove temporary resolv.conf
      rm "$extract/etc/resolv.conf"

      # Create the package for next use
      msg "Creating $package.tcz"
      [ -f "$package" ] && rm "$package"
      tempdir=$(mktemp -d)
      chmod 755 "$tempdir"
      mkdir -p "$tempdir/usr/local/share/dsas"
      chmod -R 755 "$tempdir/usr"
      # shellcheck disable=SC2086
      (cd "$extract/home/tc" || exit 1; tar -cf - vendor | tar -C "$tempdir/usr/local/share/dsas" -x -f -) 
      mksquashfs "$tempdir" "$target"
      rm -fr "$tempdir"
      md5sum "$target" | sed -e "s:  $target$::g" > "$target.md5.txt"
      echo -n "" > "$target.dep"
    fi
    install_tcz $package
}

install_phpstan(){
   package=dsasphpstan
   target=$tcz_dir/$package.tcz
   dep=$target.dep
   if test ! -f "$target"; then
      # Install PHP composer
      download -f "https:/getcomposer.org/installer" "$src_dir" "php_composer"
      mkdir -p "$extract/home/tc"
      chown ${tc}:${staff} "$extract/home/tc"
      chmod 750 "$extract/home/tc"
      cp "$src_dir/php_composer" "$extract/home/tc"
      chmod a+rx "$extract/home/tc/php_composer"
      chroot "$extract" chown -R ${tc}:${staff} "/home/tc/"
      cp /etc/resolv.conf "$extract/etc/resolv.conf" && msg "copy resolv.conf"
      cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
cd /home/tc
env HOME=/home/tc php php_composer || exit 1
rm php_composer
EOF
      chmod a+x "$extract/tmp/script"
      msg "Install PHP Composer $extract"
      HOME=/home/tc chroot --userspec=${tc} "$extract" /tmp/script || error composer installation failed

      # Install PHPSTAN
      cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
cd /home/tc
env HOME=/home/tc php composer.phar require --dev phpstan/phpstan
EOF
      chmod a+x "$extract/tmp/script"
      msg "Install PHPStan"  
      chroot --userspec=${tc} "$extract" /tmp/script

      # Remove temporary resolv.conf
      rm "$extract/etc/resolv.conf"

      # Create the package for next use
      msg "Creating $package.tcz"
      [ -f "$package" ] && rm "$package"
      tempdir=$(mktemp -d)
      chmod 755 "$tempdir"
      mkdir -p "$tempdir/home/tc"
      chmod -R 755 "$tempdir/home"
      # shellcheck disable=SC2086
      (cd "$extract/home/tc" || exit 1; tar -cf - composer.* vendor | tar -C "$tempdir/home/tc" -x -f -) 
      mksquashfs "$tempdir" "$target"
      rm -fr "$tempdir"
      md5sum "$target" | sed -e "s:  $target$::g" > "$target.md5.txt"
      echo -n "" > "$target.dep"
    fi
    install_tcz $package
}

install_dsas_js() {
   package=dsas_js
   target=$tcz_dir/$package.tcz
   dep=$target.dep

   # Remove old TCZ if JS file is newer
   if [ -f "$target" ]; then
     while IFS= read -r -d '' file; do
       if [ "$(stat -c '%Y' "$target")" -lt "$(stat -c '%Y' "$file")" ]; then
         rm -f "$target"
         break;
       fi
     done < <(find ./js -name "*.js" -print0)
   fi

   if test  ! -f "$target"; then
      _old=$extract
      extract="$build"
      if [ -d "$extract" ]; then
        while IFS= read -r -d '' _dir; do
          umount "$_dir"
        done < <(find "$extract/tmp/tcloop" -type "d" -print0)
        [ -d "$extract/proc" ] && [ "$(ls -A "$extract/proc")" != "" ] && umount "$extract/proc"
        rm -fr "$extract"
      fi
      mkdir -p "$extract"
      zcat "$squashfs" | { cd "$extract" || exit 1; cpio -i -H newc -d; }
      mount -t proc /proc "$extract/proc"

      # FIXME : Fix missing links
      # It appears that certain links are missings with the base intsall
      # and they need to be forced
      ( cd "$extract/usr/lib" || exit 1; [ -e "libpthread.so" ] || ln -s ../../lib/libpthread.so.0 libpthread.so; )
      ( cd "$extract/usr/lib" || exit 1; [ -e "libdl.so" ] || ln -s ../../lib/libdl.so.2 libdl.so; )

      # Force install of coreutils as always needed for install_tcz
      # In seperate shell to avoid modifiying local variables
      ( install_tcz coreutils compiletc curl node )

      # Copy /etc/resolv.conf file
      mkdir -p "$extract/etc"
      cp -p /etc/resolv.conf "$extract/etc/resolv.conf"

      # Copy DSAS files to build tree
      mkdir -p $extract/home/tc/dsas
      tar cf - --exclude tmp --exclude=work --exclude=.git . | tar -C $extract/home/tc/dsas -xvf - 
      chown -R ${tc}:${staff} $extract/home/tc
      if [ "$testcode" = "1" ]; then
         maketype="dev"
      else
         maketype="prod"
      fi
      mkdir -p "$extract/tmp"
      chmod 1777 "$extract/tmp" 
      cat << EOF > "$extract/tmp/script"
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
export HOME=/home/tc
export USER=tc
cd /home/tc/dsas/js
make ${maketype}
EOF
      chmod a+x "$extract/tmp/script"
      msg "Building  $package"
      HOME=/home/tc chroot --userspec=${tc} "$extract" /tmp/script || error error constructing $package

      msg "Constructing package $package"
      # Create the package for next use
      tempdir=$(mktemp -d)
      chmod 755 "$tempdir"
      mkdir -p "$tempdir/usr/local/share/www"
      chmod -R 755 "$tempdir/usr"
      cp "$extract/home/tc/dsas/js/dist/dsas.js" "$tempdir/usr/local/share/www"
      mksquashfs "$tempdir" "$target"
      rm -fr "$tempdir"
      md5sum "$target" | sed -e "s:  $target$::g" > "$target.md5.txt"
      echo -n "" > "$target.dep"
      extract="$_old"
   fi
   install_tcz $package
}

get_unpack_livecd(){
  test -f $livecd0 || msg Downloading $livecd_url
  test -f $livecd0 || cmd "$curl_cmd" -o "$livecd0" "$livecd_url" || exit 1
  mkdir -pv $mnt
  if ! ls $squashfs >/dev/null 2> /dev/null; then
    msg Unpacking the ISO $livecd_url
    mount | grep $livecd0 > /dev/null || cmd mount $livecd0 $mnt
    cmd rsync -av --exclude=boot.cat $mnt/ $newiso/
    cmd umount $mnt
  fi

  # Setup kernel name for package dependencies include "-KERNEL"
  # If on tinycore, can get it from $(uname -r), otherwise from
  # a tinycore image and find "*lib/modules/KERNEL-tinycore*" directory
  if uname -r | grep -q tinycore; then
    _kern=$(uname -r)
  else
    _kern=$(zcat $work/newiso/boot/corepure64.gz | cpio -t 2> /dev/null | grep "/lib/modules/" | head -1 | tr '/' '\n' | grep tinycore)
  fi
}

startdate=$(date +%s)

case $cmd in
work)
  pkgs=$(echo "$pkgs" | xargs)
  if [ -z "$pkgs" ]; then
    [ -L "$work" ] && rm "$work"
    mkdir -p "$work"
  else
    [ -d "$pkgs" ] || mkdir "$pkgs"
    [ -d "$work" ] && mv "$work" "$work.old"
    [ -L "$work" ] && rm "$work"
    ln -s "$pkgs" "$work"
  fi 
  ;;
source)
  tar cvzf $source --exclude=tmp --exclude=work --exclude=.git* .
  exit 0
  ;;
clean)
  make -C "$testdir" clean
  [ -e $work ] || exit 0
  if [ -d "$build/tmp/tcloop" ]; then
      while IFS= read -r -d '' _dir; do
        umount "$_dir"
      done < <(find "$build/tmp/tcloop" -type "d" -print0)
  fi
  [ -d "$image/proc" ] && [ "$(ls -A "$image/proc")" != "" ] && umount "$image/proc"
  [ -d "$build/proc" ] && [ "$(ls -A "$build/proc")" != "" ] && umount "$build/proc"
  rm -fr $image $build $newiso $mnt $dsascd $rootfs64 $dsascd.md5 \
      $docker $dockimage $source $work/dsas_pass.txt
  exit 0
  ;;
realclean)
  make -C "$testdir" realclean
  [ -e $work ] || exit 0
  rm -fr "${work:?}/?*"
  exit 0
  ;;
upgrade)
  [ -e $work ] || error work directory does not exist. run \'./make.sh work ...\'
  msg Fetching md5.db.gz
  $curl_cmd -o "$tcz_dir/md5.db.gz" "$tcz_url/md5.db.gz" || error failed to download md5.db.gz
  gzip -f -d $tcz_dir/md5.db.gz
  while IFS= read -r -d '' file; do
    _file=${file#"$tcz_dir"/}
    pkg_file=$pkg_dir/${_file%.tcz}
    pkg_file=${pkg_file%-dev}
    pkg_file=${pkg_file%-doc}.pkg
    [ -f "$pkg_file" ] && continue   # Locally built package
    [ "$_file" = "dsastestfiles.tcz" ] && continue  # Locally built file
    [ "$_file" = "dsasphpstan.tcz" ] && continue  # Locally built file
    [ "$_file" = "dsas_js.tcz" ] && { msg "Removing $_file"; rm -f "$file"; continue; } # Remove to force rebuild
    [ "$_file" = "dsaswebdriver.tcz" ] && { msg "Removing $_file"; rm -f "$file"; continue; } # Remove to force rebuild
    [ "$_file" = "firefox.tcz" ] && { msg "Removing $_file"; rm -f "$file"; continue; } # Remove to force a rebuild
    read -r hash < "$file.md5.txt"
    if ! grep -q "^$hash  $_file" $tcz_dir/md5.db; then
      # Don't use get_tcz as don't want to use local TCZ files
      rm -f "$file"
      msg "Fetching package $_file ..."
      $curl_cmd -o "$file" "$tcz_url/$_file" || exit 1
      $curl_cmd -o "${file}.dep" "$tcz_url/${_file}.dep" || exit 1
      [ -f "${file}.info" ] || $curl_cmd -o "${file}.info" "$tcz_url/${_file}.info" || exit 1
      md5sum "$file" | sed -e "s:  $file$::g" > "$file.md5.txt"
    fi
  done < <(find $tcz_dir -name "*.tcz" -print0)
  ;;

static)
  extract=$image

  # Get the ISO
  [ -e $work ] || error work directory does not exit. run \'./make.sh work ...\'
  get_unpack_livecd

  # Unpack squashfs
  if ! ls $extract/proc > /dev/null 2> /dev/null; then
    cmd mkdir -p $extract
    zcat "$squashfs" | { cd "$extract" || exit 1; cpio -i -H newc -d; }
  fi

  # Install the needed packages
  install_tcz compiletc
  install_tcz openssl
  install_tcz libxml2
  install_tcz libssh2
  install_tcz libzip
  install_tcz bzip2-lib
  install_tcz php-8.2-cgi
  install_tcz php-8.2-ext
  install_tcz php-pam
  install_tcz curl
  install_tcz rsync
  install_tcz node

  [ "$arch" != 64 ] && install_tcz pcre2
  [ "$arch" = 64 ] && install_tcz pcre21032
  
  # FIXME Force installation of a PCRE that works with PHP composer
  install_tcz pcre21042

  # Copy DSAS code to test tree  
  mkdir -p $extract/home/tc/dsas
  tar cf - --exclude tmp --exclude=work --exclude=.git . | tar -C $extract/home/tc/dsas -xvf -
  chown -R ${tc}:${staff} $extract/home/tc 

  # Copy /etc/resolv.conf file 
  mkdir -p "$extract/etc"
  cp -f /etc/resolv.conf "$extract/etc/resolv.conf"

  if [ -z "$pkgs" ] || [ -z "${pkgs##*phpstan*}" ]; then
    # Install PHP cli and add iconv and phar extension
    install_tcz php-8.2-cli

    cp $append/usr/local/etc/php/php.ini $extract/usr/local/etc/php/php.ini
    sed -i -e "s/;extension=phar/extension=phar/" $extract/usr/local/etc/php/php.ini
    sed -i -e "s/;extension=iconv/extension=iconv/" $extract/usr/local/etc/php/php.ini
    sed -i -e "s/;extension=curl/extension=curl/" $extract/usr/local/etc/php/php.ini
    sed -i -e "s/;extension=zip/extension=zip/" $extract/usr/local/etc/php/php.ini
    sed -i -e "s/;extension=tokenizer/extension=tokenizer/" $extract/usr/local/etc/php/php.ini

    # Install PHP webdriver via composer             
    install_phpstan

    cat << EOF > $extract/home/tc/phpstan.neon
parameters:
  level: 9
  paths:
    - dsas/append/usr/local/share/www/api
EOF
    chown -R ${tc}:${staff} $extract/home/tc

    cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
cd /home/tc
env HOME=/home/tc vendor/bin/phpstan
EOF
    chmod a+x "$extract/tmp/script"
    msg "Running PHPStan on usr/local/share/www/api"
    chroot --userspec=${tc} "$extract" /tmp/script || error error running phpstan
  fi

  if [ -z "$pkgs" ] || [ -z "${pkgs##*eslint*}" ]; then
    cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export http_proxy=${http_proxy:=}
export https_proxy=${https_proxy:=}
export HOME=/home/tc
cd /home/tc/dsas/js
make dev
EOF
    chmod a+x "$extract/tmp/script"
    msg "Running eslint on js/..."
    chroot --userspec=${tc} "$extract" /tmp/script || error error running eslint
  fi

  if [ -z "$pkgs" ] || [ -z "${pkgs##*shellcheck*}" ]; then
    # Shellcheck needs Haskell/Cabal to rebuild. For now only allow on a 64bit platform
    # and download a static binary, or use shellchek if it is installed
    if which shellcheck > /dev/null 2>&1; then
      msg "Running shellcheck on shell code"
      shellcheck -x "append/usr/local/sbin/checkfiles" \
                    "append/usr/local/sbin/dsaspasswd" \
                    "append/usr/local/sbin/getcertificate" \
                    "append/usr/local/sbin/getfiles" \
                    "append/usr/local/sbin/killtask" \
                    "append/usr/local/sbin/rotatelogs" \
                    "append/usr/local/sbin/runtask" \
                    "append/usr/local/sbin/snmpdsas" \
                    "append/usr/local/sbin/sysloghaut" \
                    "append/etc/init.d/services/dsas" \
                    "append/etc/init.d/rcS.docker" \
                    "make.sh"
    else
      [ "$(uname -m)" = "x86_64" ] || error "shellcheck can only be run on a 64bit machine"
      _uri="https://github.com/koalaman/shellcheck/releases/download/v0.9.0/shellcheck-v0.9.0.linux.x86_64.tar.xz"
      _src=$(basename "$_uri")
      download "$_uri" "$src_dir"
      unpack "$src_dir/$_src" "$extract/home/tc" || error "Can not unpack $_src"

      cat << EOF > $extract/tmp/script
export LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/lib
export HOME=/home/tc
export USER=tc
cd /home/tc/dsas
shellcheck=\$(find /home/tc -type f -name "shellcheck")
[ -z \"\$shellcheck\" ] && { echo "shellcheck not found"; exit 1; }
\$shellcheck -x "append/usr/local/sbin/checkfiles" \
                "append/usr/local/sbin/dsaspasswd" \
                "append/usr/local/sbin/getcertificate" \
                "append/usr/local/sbin/getfiles" \
                "append/usr/local/sbin/killtask" \
                "append/usr/local/sbin/rotatelogs" \
                "append/usr/local/sbin/runtask" \
                "append/usr/local/sbin/snmpdsas" \
                "append/usr/local/sbin/sysloghaut" \
                "append/etc/init.d/services/dsas" \
                "append/etc/init.d/rcS.docker" \
                "make.sh"
EOF
      chmod a+x "$extract/tmp/script"
      msg "Running shellcheck on shell code"
      chroot --userspec=${tc} "$extract" /tmp/script || error error running shellcheck
    fi
  fi

  if [ "$keep" = "0" ]; then
    rm -fr $image $newiso $mnt
  fi

  ;;

build)
  shift
  extract=$build
  [ -e $work ] || error work directory does not exit. run \'./make.sh work ...\'
  get_unpack_livecd

  [ -d "$extract" ] || mkdir -p "$extract"
  [ -z "$pkgs" ] && error "No package to build given"
  # shellcheck disable=SC2086
  build_pkg $pkgs
  exit 0
  ;;
docker)
  # Force build of the ISO
  shift
  [ -f "$dsascd" ] || $0 "$@"
  
  # Repack the disk image
  mkdir -p "$newiso"
  mount "$dsascd" "$newiso"
  extract=$rootfs64
  msg "Extracting DSAS files"
  rm -fr "$extract"
  mkdir -p "$extract"
  zcat "$squashfs" | { cd "$extract" || exit 1; cpio -i -H newc -d; }
  umount "$newiso"
  msg "Setting up DSAS for docker"
  install_tcz squashfs-tools
  patch -d "$extract" usr/bin/tce-load  "$(readlink -f docker/tce-load.patch)"
  patch -d "$extract" usr/bin/filetool.sh  "$(readlink -f docker/filetool.sh.patch)"
  echo -n tc > $extract/etc/sysconfig/tcuser
  msg "Compressing DSAS files"  
  mkdir -p $docker
  tar -czC $extract -f $docker/rootfs64.tar.gz .
  msg "Creating docker install package in $dockimage"
  cp -pr docker/Makefile docker/Dockerfile $docker
  tar -czC $docker -f $dockimage .
  if [ "$keep" = "0" ]; then
    rm -fr $newiso $extract $docker
  fi
  exit 0  
  ;;
""|iso)
  extract=$image

  # Get the ISO
  [ -e $work ] || error work directory does not exit. run \'./make.sh work ...\'
  get_unpack_livecd

  # Unpack squashfs
  if ! ls $extract/proc > /dev/null 2> /dev/null; then
    cmd mkdir -p $extract
    zcat "$squashfs" | { cd "$extract" || exit 1; cpio -i -H newc -d; }
  fi

  # Install the needed packages
  install_tcz busybox  # Busybox with PAM and TMOUT support
  install_tcz openssl  # explicitly install openssl first so avail to ca-certificate
  install_tcz kmaps
  install_tcz openssh
  install_tcz sshpass
  install_tcz coreutils     # For sha256, etc
  install_tcz osslsigncode
  install_tcz libxml2-bin   # For xmllint
  install_tcz gnupg
  install_tcz lighttpd
  install_tcz clamav
  install_tcz php-8.2-cgi
  install_tcz php-8.2-ext
  install_tcz php-pam
  install_tcz dialog
  install_tcz rpm
  install_tcz p7zip         # Needed by LiveUpdate
  [ "$arch" = 64 ] && install_tcz zip unzip
  [ "$arch" != 64 ] && install_tcz zip-unzip     # Needed to allow repacking of unsigned zip files
  install_tcz Linux-PAM
  install_tcz net-snmp
  install_tcz lftp
  install_tcz libpam-radius-auth
  install_tcz sed           # Needed for 'sed -z'

  # FIXME Tinycore 32bit doesn't include the right pcre dependance and 64bit uses a
  # a difference dependance. 
  [ "$arch" != 64 ] && install_tcz pcre2
  [ "$arch" = 64 ] && install_tcz pcre21032

  # Install VMWARE open-vm-tools to allow for VM migration
  [ "$vmtools" = "1" ] && install_tcz open-vm-tools

  if [ "$testcode" = "1" ]; then
    # Install test files. Force remove temporary PKG file
    if test ! -f "$tcz_dir/dsastestfiles.tcz"; then
      make -C "$testdir" clean
      make -C "$testdir" pkg
      install_tcz dsastestfiles
    else
      t0=$(stat -c '%Y' "$tcz_dir/dsastestfiles.tcz")
      t1=$(find "$testdir" -type f -exec stat -c '%Y' "{}" \; | sort -nr  | head -1)
      if [ "$t1" -gt "$t0" ] ; then
        # The test files are newer than the existing version. Rebuild
        rm -f "$tcz_dir/dsastestfiles.tcz"
        make -C "$testdir" clean
        make -C "$testdir" pkg
      fi
      install_tcz dsastestfiles
    fi
    rm -f $pkg_dir/dsastestfiles.pkg

    # Install packages to allow testing of rsyslog and radius
    install_tcz freeradius
    install_tcz rsyslog

    # Install firefox, explicitly install the fonts
    install_firefox
    install_tcz harfbuzz fribidi # FIXME missing firefox dependency !!
    install_tcz Xorg-fonts
    install_tcz unifont 

    # Install PHP
    install_tcz php-8.2-cli

    # Download and install the gecko (firefox) webdriver
    download "https://github.com/mozilla/geckodriver/releases/download/v0.31.0/geckodriver-v0.31.0-linux${arch}.tar.gz" "$src_dir"
    tar xCzf "$extract/usr/local/bin" "$src_dir/geckodriver-v0.31.0-linux${arch}.tar.gz"   
  fi

  # Install/build dsas.js 
  install_dsas_js

  # Copy the pre-extracted packages to work dir. This must be after packages
  # are installed to allow for files to be overwritten. Run as root 
  # and correct the ownership of files 
  msg Append DSAS files
  rsync -rlptv "$append/" "$extract/"
  mkdir -p "$extract/home/tc"
  chown root:root "$extract"
  chmod 755 "$extract/home"

  # Now that php.ini is copied, if in test mode add iconv, phar, etc 
  if [ "$testcode" = "1" ]; then
    sed -i -e "s/;extension=phar/extension=phar/" $extract/usr/local/etc/php/php.ini
    sed -i -e "s/;extension=iconv/extension=iconv/" $extract/usr/local/etc/php/php.ini
    sed -i -e "s/;extension=curl/extension=curl/" $extract/usr/local/etc/php/php.ini
    sed -i -e "s/;extension=zip/extension=zip/" $extract/usr/local/etc/php/php.ini

    # FIXME Force installation of a PCRE that works with PHP composer
    install_tcz pcre21042
    
    # Install PHP webdriver via composer. Needs php.ini configured
    install_webdriver
  fi

  # Populate /var/cache/hrmib so that SNMP can detect installed software and versions
  build_pkg_cache /var/cache/hrmib

  # prevent autologin of tc user
  ( cd "$extract/etc" || exit 1; sed -i -r 's/(.*getty)(.*autologin)(.*)/\1\3/g'  inittab; )

  # Create users
  passfile=$work/dsas_pass.txt
  cp /dev/null "$passfile"
  chmod 700 "$passfile"

  create_users=$extract/tmp/create_users.sh
  cp /dev/null "$create_users"

  msg WARNING: Change default password for 'tc' user and run 'filetool.sh -b'
  echo tc:dSaO2021DSAS >> "$passfile"
cat << EOF >> "$create_users"
echo tc:dSaO2021DSAS | chpasswd -c sha512
mkdir /home/tc/.ssh
chmod 700 /home/tc/.ssh
chown tc:staff /home/tc/.ssh
EOF

  msg adding user 'verif'
  pwgen $service_pass_len
  echo "verif:$pass" >> "$passfile"
  cat << EOF >> "$create_users"
adduser -s /bin/false -u 2000 -D -h /home/verif verif
echo verif:$pass | chpasswd -c sha512
EOF

  msg adding user 'bas'
  pwgen $service_pass_len
  echo "bas:$pass" >> "$passfile"
  cat << EOF >> "$create_users"
adduser -s /bin/false -u 2001 -D -h /home/bas bas
echo bas:$pass | chpasswd -c sha512
mkdir /home/bas/.ssh
chmod 700 /home/bas/.ssh
chown bas:bas /home/bas/.ssh
EOF

  msg adding user 'haut'
  pwgen $service_pass_len
  echo "haut:$pass" >> "$passfile"
  cat << EOF >> "$create_users"
adduser -s /bin/false -u 2002 -D -h /home/haut haut
echo bas:$pass | chpasswd -c sha512
mkdir /home/haut/.ssh
chmod 700 /home/haut/.ssh
chown haut:haut /home/haut/.ssh
EOF

  cat << EOF >> "$create_users"
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
chown root:root /etc/sudoers
chmod 700 /root
chmod -R g-s /home
chown -R tc:staff /home/tc
chmod -R o-rwx /home/tc /home/haut /home/bas /home/verif 
chown -R root:staff /var/dsas
chmod 775 /var/dsas          # Write perm for verif
chmod 640 /var/dsas/?*.dsas
chmod 660 /var/dsas/dsas_conf.xml
chown tc:verif /var/dsas/dsas_conf.xml
chown root:repo /var/dsas/repo.conf.dsas
chown -R root:staff /opt
chmod 770 /opt
chmod 770 /opt/.filetool.lst
chmod 644 /usr/local/share/www/?* /usr/local/share/www/api/?* /usr/local/share/www/en/?* /usr/local/share/www/fr/?*
chmod 755 /usr/local/share/www/en /usr/local/share/www/fr /usr/local/share/www/api
sed -i "s/umask 0[0-7][0-7]/umask 027/" /etc/profile
echo "
# Forbid core dumps (suggestion lynis)
ulimit -c 0

# Force inactivity timeout (suggestion lynis)
export TMOUT=300
" >> /etc/profile

# Ensure the umask is 027 (suggestion lynis)
cp /etc/init.d/rcS /etc/init.d/rcS.old
grep -q umask /etc/init.d/rcS && sed -i -e "s/umask 0[0-7][0-7]/umask 027/" /etc/init.d/rcS
if ! grep -q umask /etc/init.d/rcS; then
  # Find first non comment line, to add umask if needed
  _line=\$(grep -n -v "^#" /etc/init.d/rcS | head -1 | cut -d: -f1)
  head -\$((_line - 1)) /etc/init.d/rcS > /etc/init.d/rcS.tmp
  echo "umask 027" >> /etc/init.d/rcS.tmp
  tail +\$_line /etc/init.d/rcS >> /etc/init.d/rcS.tmp
  mv -f /etc/init.d/rcS.tmp /etc/init.d/rcS
  chmod 755 /etc/init.d/rcS
fi

# Ensure files in /etc/sysconfig are world readable (needed after setting umask 027)
sed -i -e "s:^\(\s*\)\(.* > \)\(/etc/sysconfig/.*\)$:\1\2\3\n\1\[ \-e \"\3\" \] \&\& chmod 644 \3:g" /etc/init.d/tc-config

# set swapfile options in /etc/fstab (suggestion lynis)
sed -i -e "s:\(swap\s*defaults,\):\1swap,:" /etc/init.d/tc-config

# set noexec,nosuid,nodev on /dev/shm (suggestion lynis)
sed -i -e "s:\(/dev/shm\s*tmpfs\s*defaults\):\1,noexec,nosuid,nodev:" /etc/fstab

# Use hidepid=2 on /proc (suggestion lynis)
sed -i -e "s:\(proc\s*defaults\):\1,hidepid=2:" /etc/fstab

EOF

  chmod 755 "$create_users"
  chroot "$extract" /tmp/create_users.sh
  rm "$create_users"

  # Special case, very limited busybox for chroot with only /bin/ash and /usr/bin/env installed
  _old=$extract
  extract=$extract/opt/lftp
  ( install_tcz ash )
  extract=$_old

  # Install lftp and dependencies in /opt so that they can be available in chroot jail
  # Install missing libraries. Don't use harlink to avoid possible chroot breakout
  cat << EOF > $extract/tmp/script
#! /bin/sh
  export LD_LIBRARY_PATH=/usr/lib:/lib:/usr/local/lib
  _ldir=/opt/lftp
  (umask 022; mkdir -p \$_ldir/lib \$_ldir/dev \$_ldir/etc \$_ldir/tmp \$_ldir/home)
  chmod 775 \$_ldir/tmp
  chown root:staff \$_ldir/tmp
  (umask 027; mkdir -p \$_ldir/home/haut)
  chown haut:haut \$_ldir/home/haut
  cp -p /lib/ld-linux* \$_ldir/lib
  grep ^haut /etc/passwd > \$_ldir/etc/passwd
  echo haut:x:2002: > \$_ldir/etc/group
  cp -p /etc/host.conf /etc/nsswitch.conf \$_ldir/etc
  for _file in /usr/local/bin/lftp /usr/local/etc/lftp.conf /usr/local/bin/ssh; do
    while [ -L "\$_file" ]; do
      _link=\$(readlink "\$_file")
      _d=\$(dirname "\$_ldir/\$_file")
      [ -d "\$_d" ] || (umask 022; mkdir -p \$_d)
      1>&2 echo "  [-] Linking \$_ldir/\$_file to \$_link"
      ln -s "\$_link" "\$_ldir/\$_file"
      if [ "\$(dirname \$_link)" = "." ]; then
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
      [ "\$_line" = "\$_l2" ] && continue
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
        if [ "\$(dirname \$_link)" = "." ]; then
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
  { msg "Setting up lftp chroot jail"; chroot $extract /tmp/script; } || error "Unexpected error ($?) in lftp chroot creation"
  /bin/rm -f $extract/tmp/script
  mknod -m=666 $extract/opt/lftp/dev/null c 1 3

  # Add console timeout to all .profile files
  while IFS= read -r -d '' file; do
    echo "export TMOUT=300" >> "$file"
  done < <(find $extract -name ".profile" -print0)

  # customize boot screen
  cp -p ./boot/isolinux/boot.msg "$newiso/boot/"
  if [ "$arch" != "64" ]; then
    cp -p ./boot/isolinux/isolinux.cfg "$newiso/boot/isolinux"
  else
    cp -p ./boot/isolinux/isolinux64.cfg "$newiso/boot/isolinux/isolinux.cfg"
  fi

  # Change ISO name if test version
  [ "$testcode" = "1" ] && dsascd=${dsascd%.iso}-test.iso
  
  msg "creating $dsascd"
  ( cd "$extract" || exit 1; find . | cpio -o -H newc; ) | gzip -2 > "$squashfs"
  mkisofs=$(which mkisofs genisoimage | head -n 1)
  cmd "$mkisofs" -l -J -R -V TC-custom -no-emul-boot -boot-load-size 4 \
    -boot-info-table -b boot/isolinux/isolinux.bin \
    -c boot/isolinux/boot.cat -o "$dsascd" "$newiso"
  msg "creating $dsascd.md5"
  (cd "$work" || exit 1; md5sum "$(basename "$dsascd")"; ) > "$dsascd.md5"

  if [ "$keep" = "0" ]; then
    if [ -d "$build/tmp/tcloop" ]; then
      while IFS= read -r -d '' _dir; do
        umount "$_dir"
      done < <(find "$extract/tmp/tcloop" -type "d" -print0)
    fi
    rm -fr $image $newiso $mnt
  fi
  exit 0
  ;;
*)
  echo "Invalid command $cmd"
  exit 1
esac


