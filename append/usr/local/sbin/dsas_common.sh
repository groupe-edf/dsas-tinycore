#! /bin/sh

# CONF=/var/dsas/dsas_conf.xml
# DSAS_HOME=/home/dsas
CONF=/home/tc/dsas/var/dsas/dsas_conf.xml
DSAS_HOME=/home/tc/dsas/home/dsas

INTERCO="192.168.192.0"
INTERCO_MASK="255.255.255.0"
INTERCO_BAS="$(echo $(echo $INTERCO | cut -d. -f1-3).$(($(echo $INTERCO | cut -d. -f4) + 1)) )"
INTERCO_HAUT="$(echo $(echo $INTERCO | cut -d. -f1-3).$(($(echo $INTERCO | cut -d. -f4) + 2)) )"

DSAS_HAUT=$DSAS_HOME/haut
DSAS_BAS=$DSAS_HOME/bas
DSAS_VERIF=$DSAS_HOME/verif

if [ -f $VAR/dsas_typ ]; then
  TYP="$(cat $VAR/dsas_typ)"
else
  TYP="haut"
fi

logfile=""
logstdout=0
verbose=0
dryrun=0
grp="share"

check_dsas(){
  [ -d $DSAS_HOME ] || (echo "DSAS home directory missing"; exit -1)
  [ -d $DSAS_HAUT ] || (echo "DSAS haut directory missing"; exit -1)
  [ -d $DSAS_BAS ] || (echo "DSAS bas directory missing"; exit -1)
}

myecho(){
  [ $verbose -ne 0 ] && echo $@
}

utc_date(){
  date --utc '+%Y%m%d%H%M%S'
}

msg() {
  if [ $logstdout -eq 1 ]; then
    printf "%-3s %-15s %-32s %s %s\n" "$1" "$2" "$3" "$4" "$5"
  elif [ -n $logfile ]; then
    printf "%-3s %-15s %-32s %s %s\n" "$1" "$2" "$3" "$4" "$5" >> $logfile
  fi
}

msgline() {
  local file=$1
  local status=$2
  local md5=$(cat $file | md5sum | sed -e "s/  -$//g")
  local _file=`echo $file | sed -e "s:^${haut}/::g"`
  local d=utc_date
  case $status in
    0) [ $verbose == 1 ] && msg "  "  "Ok"  $md5 $_file ;;
    -1)  msg "XX"  "Unknown type"   $md5  $d $_file ;;
    1)   msg "**"  "Bad Sig"        $md5  $d $_file ;;
    2)   msg "$$"  "Checksum fail"  $md5  $d $_file ;;
    3)   msg "**"  "Bad Interm Sig" $md5  $d $_file ;;
    4)   msg "**"  "Fail virus chk" $md5  $d $_file ;;
    5)   msg "**"  "Bad RPM Sig"    $md5  $d $_file ;;
    255) msg "**"  "Not signed"     $md5  $d $_file ;;
    *)   msg "XX"  "Unknown status" $md5  $d $_file ;;
  esac
}

# Usage : check_checksum <file> <chksum> <type>
check_checksum() {
  local chk

  case $3 in
    sha512)
      chk=$(cat $1 | sha512sum - | sed -e "s/ -//g")
      ;;
    sha256)
      chk=$(cat $1 | sha256sum - | sed -e "s/ -//g")
      ;;
    sha)
      chk=$(cat $1 | sha1sum - | sed -e "s/ -$//g")
      ;;
    md5)
      chk=$(cat $1 | md5sum - | sed -e "s/ -$//g")
      ;;
    *)
     return 0
     ;;
  esac

  if [ $chk != $2 ]; then
    return 0
  fi
  return 1
}

task_id_to_idx(){
  local _task_id
  local i=1
  while :; do
    _task_id=$(xmllint --xpath "string(dsas/tasks/task[$i]/id)" $CONF)
    [ -z "$_task_id" ] && return -1;
    [ "$1" == "$_task_id" ] && return $i
    i=$(($i + 1))
  done
}

get(){
  local force=0
  if [ "$1" == "-force" ]; then
    shift 1
    force=1
  fi
  if [ "${1:0:4}" == "scp:" ]; then
    # Curl not built with scp support
    if [ $force -eq 0 ] && [ $dryrun -ne 0  ]; then
      echo "[DryRun] scp ${1:4} 21"
    else
      [ $verbose -ne 0 ] && echo "scp ${1:4} $2"
      $(umask 007 && scp ${1:4} $2)
    fi
  elif  [ "${1:0:5}" == "sftp:" ]; then
    # Curl not built with sftp support
    if [ $force -eq 0 ] && [ $dryrun -ne 0  ]; then
      echo "[DryRun] sftp ${1:5} $2"
    else
      [ $verbose -ne 0 ] && echo "sftp ${1:5} $2"
      $(umask 007 && sftp ${1:5} $2)
    fi
  else
    if [ $force -eq 0 ] && [ $dryrun -ne 0  ]; then
      echo "[DryRun] curl -o $2 $1"
    else
      [ $verbose -ne 0 ] && echo "curl -o $2 $1"
      $(umask 007 && curl -o $2 $1 2> /dev/null)
    fi
  fi
}

mv() {
  if [ $dryrun == "0" ]; then
    [ -d $(dirname $2) ] || ( mkdir -m 770 -p $(dirname $2); chgrp -R bas $(dirname $2))
    # We can't change the owner of the file as we aren't root. So a 
    # move must be treated as a copy and delete
    /bin/cp $1 $2
    chgrp bas $2
    /bin/rm $1
  else
    echo "[DryRun] mv $*"
  fi
}

ln() {
  if [ $dryrun == "0" ]; then
    [ -d $(dirname $2) ] || ( mkdir -m 770 -p $(dirname $2); chgrp -R bas $(dirname $2))
    # This script is not running as root so can't change the owner. We
    # first have to copy the file
    cp $1 $1.tmp.$$
    /bin/mv -f $1.tmp.$$ $1
    chmod 0640 $1
    chgrp $grp $1
    /bin/ln -f $* 
  else
    [ -d $(dirname $2) ] || echo "[DryRun] mkdir -p $(dirname $2)"
    echo "[DryRun] ln $*"
  fi
}

rm() {
  if [ $dryrun == "0" ]; then
    /bin/rm $*
  else
    echo "[DryRun] rm $*"
  fi
}

get_uri(){
  if [ "$TYP" == "haut" ]; then
    echo $(xmllint --xpath "string(dsas/tasks/task[$id]/uri)" $CONF)
  else
    local _dir=$(xmllint --xpath "string(dsas/tasks/task[$id]/dir)" $CONF)
    echo "scp:tc\@$INTERCO_HAUT:/$DSAS_BAS/$_dir/"
  fi
}

fileargs() {
while [ "$#" -gt 3 ]; do
  shift 3
  echo $1
  shift 1
done
}

get_dirlist(){
  if [ "${1:0:5}" == "sftp:" ]; then
    echo "$(echo 'ls' | sftp ${1:5})"
  elif [ "${1:0:4}" == "ftp:" ]; then
    echo $(fileargs $(curl $1 2> /dev/null))
  else
    #$(curl $1 2> /dev/null |grep -o '<a .*href=.*>' | sed -e 's/<a /\n<a /g' | sed -e 's/<a .*href=['"'"'"]//' -e 's/["'"'"'].*$//' -e '/^$/d' -e/^?/d' -e '/^\?.*/d') 
    :
  fi
}