#! /bin/sh

# WARNING : Very rough script to build missing packages
# It assumes build machine is TinyCore and it will 
# temporarily install packages on your machine 

cd $(dirname "$0")
pkg_dir=./pkg
work=./work
src_dir=$work/src
destdir=$work/dest
build_dir=$work/build
tcz_dir=$work/tcz

rebuild=0
forcedownload=0

get() {
  _src=$(basename $1)
  echo "Downloading $_src"
  curl -L -o $2/$_src $1 2> /dev/null  
}

download() {
  if [ $forcedownload -eq 0 ]; then
    if [ ! -f "$1" ]; then
      case $(echo $1 | sed -e "s/.*\(\..*\)$/\1/g") in
        .tgz|.tbz|.tar|.gz|.bz2) get $*; ;;
        *) echo "Unknown file extension $1"; ;;
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
        echo "An archive can not be a gzip"
      fi
      ;;
    .bz2) 
      if [ "${1: -8}" == ".tar.bz2" ]; then
        tar xvjCf $2 $1;
      else
        echo "An archive can not be a bzip2"
      fi
      ;;
    *)
      echo "Unknown file extension $1"
      retval=1
      ;;
  esac
}

build_tcz() {
  pkg_path=$1/$2-$3
  echo "Configuring $2-$3"
  (cd $pkg_path; ./configure)
  echo "Building $2-$3"
  (cd $pkg_path; make)
  echo "Installing $2-$3"
  rm -fr $4/$2
  mkdir -p $4/$2
  (cd $pkg_path; make DESTDIR=$4/$2 install)
  echo "Creating $2.tcz"
  [ -f "$5/$2.tcz" ] && rm $5/$2.tcz
  (cd $4/$2/.. ; mksquashfs $2 $2.tcz)
  mv $4/$2.tcz* $5
  rm -fr $4/$2 $pkg_path
}

build_pkg() {
  for pkg_file in $1; do
    echo "Building $pkg_file"
    . $pkg_file
    _src=$(basename $_uri)
    [ ! -f "$tcz_dir/$_pkg.tcz" ]
    if [ $rebuild -eq "1" ] || [ ! -f "$tcz_dir/$_pkg.tcz" ]; then
      for dep in $_build_dep; do
        if ! $(tce-status -i | grep -q $dep); then
          echo "dep : $dep"
          ./build.sh $newargs $dep 
          tce-load -i $tcz_dir/$dep.tcz
        fi
      done
      echo "Building $_pkg.tcz"
      download $_uri $src_dir
      unpack $src_dir/$_src $build_dir
      build_tcz $build_dir $_pkg $_version $(realpath $destdir) $tcz_dir
      cat $tcz_dir/$_pkg.tcz | md5sum | sed -e "s/ -$//g" > $tcz_dir/$_pkg.tcz.md5.txt
      [ -f $tcz_dir/$_pkg.tcz.dep ] && rm $tcz_dir/$_pkg.tcz.dep
      for dep in $_dep; do
        echo $dep >> $tcz_dir/$_pkg.tcz.dep
      done
    fi
  done
}

pkgs=""
newargs=""
while [ "$#" -gt 0 ]; do
  case $1 in
    -r|--rebuild) rebuild=1; newargs="$newargs $1" ;;
    -f|--download) forcedownload=1; newargs="$newargs $1" ;;
    *) pkgs="$pkgs $pkg_dir/$1.pkg"
  esac
  shift
done

[ -d $build_dir ] || mkdir -p $build_dir
[ -d $destdir ] || mkdir -p $destdir
[ -z $pkgs ] && $(echo "No package to build given"; exit 1) 
build_pkg $pkgs


