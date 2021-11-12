#! /bin/sh

VAR="/var/dsas"
LOG="/home/dsas/log"
CONF="$VAR/dsas_conf.xml.active"
RUNLOG="$LOG/dsas_runlog"
DSAS_HOME="/home/dsas"

INTERCO="192.168.192.0"
INTERCO_MASK="255.255.255.0"
INTERCO_BAS="$(echo $(echo $INTERCO | cut -d. -f1-3).$(($(echo $INTERCO | cut -d. -f4) + 1)) )"
INTERCO_HAUT="$(echo $(echo $INTERCO | cut -d. -f1-3).$(($(echo $INTERCO | cut -d. -f4) + 2)) )"

DSAS_HAUT=$DSAS_HOME/haut/share
DSAS_BAS=$DSAS_HOME/bas/share

if [ -f $VAR/dsas_typ ]; then
  TYP="$(cat "$VAR/dsas_typ")"
else
  TYP="haut"
fi

logfile=""
logstdout=0
verbose=0
dryrun=0
grp="share"

check_dsas(){
  [ -d $DSAS_HOME ] || { echo "DSAS home directory missing"; exit 1; }
  [ "$(whoami)" == "bas" ] || [ -d "$DSAS_HAUT" ] || { echo "DSAS haut directory missing"; exit -1; }
  [ "$(whoami)" == "haut" ] || [ -d "$DSAS_BAS" ] || { echo "DSAS bas directory missing"; exit -1; }
}

myecho(){
  [ $verbose -ne 0 ] && echo $@
  # If not verbose the status will be 1. explicitly return 0
  return 0
}

utc_date(){
  date --utc '+%Y%m%d%H%M%S'
}

fixdate(){
  printf "$1" | sed -E -e 's/(....)(..)(..)(..)(..)(..)/\1-\2-\3 \4:\5:\6/'
}

should_run(){
 _dif=$(($(date -d "$(fixdate $(utc_date) )" '+%s') - $(date -d "$(fixdate $1)" '+%s') ))
  case "$2" in
    never) return 1; ;;
    hourly) [ $_dif -lt 3600 ] && return 1;  ;;
    daily) [ $_dif -lt 86400 ] && return 1; ;;
    weekly) [ $_dif -gt 604800 ] && return 1; ;;
    monthly) [ $_dif -gt 18144000 ] && return 1; ;;
    *) return 1; ;;
  esac
  return 0
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
  local _file=`echo $file | sed -e "s:^${DSAS_HAUT}/::g"`
  local d=$(utc_date)
  case $status in
    0)   msg "  "  "Ok"              $md5 $d $_file ;;
    -1)  msg "XX"  "Unknown type"   $md5  $d $_file ;;
    1)   msg "**"  "Bad Sig"        $md5  $d $_file ;;
    2)   msg "--"  "Checksum fail"  $md5  $d $_file ;;
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
      chk=$(cat "$1" | sha512sum - | sed -e "s/ -//g")
      ;;
    sha256)
      chk=$(cat "$1" | sha256sum - | sed -e "s/ -//g")
      ;;
    sha)
      chk=$(cat "$1" | sha1sum - | sed -e "s/ -$//g")
      ;;
    md5)
      chk=$(cat "$1" | md5sum - | sed -e "s/ -$//g")
      ;;
    *)
     return 0
     ;;
  esac

  if [ $chk != "$2" ]; then
    return 0
  fi
  return 1
}

task_id_to_idx(){
  local _task_id
  local i=1
  while :; do
    _task_id=$(xmllint --xpath "string(dsas/tasks/task[$i]/id)" "$CONF")
    [ -z "$_task_id" ] && return 1;
    [ "$1" == "$_task_id" ] && echo $i && return 
    i=$(($i + 1))
  done
}

ln() {
  if [ "$dryrun" == "0" ]; then
    [ -d $(dirname "$2") ] || ( mkdir -m 770 -p $(dirname "$2"); chgrp -R $grp $(dirname "$2"))
    # This script is not running as root so can't change the owner. We
    # first have to copy the file
    cp --preserve=timestamp "$1" "$1.tmp.$$"
    /bin/mv -f "$1.tmp.$$" "$1"
    chmod 0640 "$1"
    chgrp $grp "$1"
    /bin/ln -f "$1" "$2" 
  else
    [ -d $(dirname $2) ] || echo "[DryRun] mkdir -p $(dirname $2)"
    echo "[DryRun] ln $*"
  fi
}

rm() {
  if [ "$dryrun" == "0" ]; then
    #FIXME is there a better way of handling spaces in the args ?
    while [ "$#" -gt 0 ]; do
      /bin/rm -fr "$1"
      shift
    done
  else
    echo "[DryRun] rm $*"
  fi
}

get_uri(){
  if [ "$TYP" == "haut" ]; then
    echo $(xmllint --xpath "string(dsas/tasks/task[$1]/uri)" "$CONF") 
  else
    local _dir=$(xmllint --xpath "string(dsas/tasks/task[$1]/directory)" "$CONF")
    local _uri="$DSAS_HOME/bas"
    _uri=${DSAS_BAS:${#_uri}}
    echo "sftp://bas:@$INTERCO_HAUT$_uri/$_dir/"
  fi
}

fileargs() {
while [ "$#" -gt 3 ]; do
  shift 3
  echo $1
  shift 1
done
}

# Usage get_certificate fingerprint
get_certificate(){
  local cert type
  local i=1
  local incert="false"
  while :; do
    cert=$(xmllint --xpath "string(dsas/certificates/certificate[$i]/pem)" "$CONF")
    [ -z "$cert" ] && break
    type=$(xmllint --xpath "string(dsas/certificates/certificate[$i]/type)" "$CONF")
    echo "$cert" > /tmp/cert.$$

    case $type in
      x509)
        f=$(openssl x509 -in /tmp/cert.$$ -noout -fingerprint -sha256 -inform pem  | cut -d= -f2 | sed -e "s/://g" | tr "[A-Z]" "[a-z]")
        [ "$f" == "$1" ] && { echo $i; return; }
        ;;
      gpg)
        gpg -v < /tmp/cert.$$ 2>&1 | grep -q $1 && { echo $i; return; }
        ;;
      pubkey)
        cat /tmp/cert.$$ | tr -d "\n" | tr -d "\r" | sed -e "s/^-----BEGIN [A-Z ]*PUBLIC KEY-----//" | \
            sed -e "s/-----END [A-Z ]*PUBLIC KEY-----$//" | base64 -d | sha256sum | cut -f1 -d" " | \
            grep -q $1 && { echo $i; return; }
        ;;
      *)
        1>&2 echo "Unknown certificate type"
        ;;
    esac
    /bin/rm /tmp/cert.$$
    i=$((i + 1))
  done

  # Not one of the added certificates. Is it in the certificate store ?
  while IFS= read -r line; do
    if [ "$line" == "-----BEGIN CERTIFICATE-----" ]; then
      if "$incert" == "true" ]; then
        echo "error parsing ca-bundle.crt"
      else
        incert="true"
        cert="$line"
      fi
    elif [ "$line" == "-----END CERTIFICATE-----" ]; then
      if [ "$incert" == "false" ]; then
        echo "error parsing ca-bundle.crt"
      else
        cert="$cert\n$line"
        incert="false"
        echo -e "$cert" > /tmp/cert.$$
        f=$(openssl x509 -in /tmp/cert.$$ -noout -fingerprint -sha256 -inform pem  | cut -d= -f2 | sed -e "s/://g" | tr "[A-Z]" "[a-z]")
        [ "$f" == "$1" ] && { echo 0; return; }
        /bin/rm /tmp/cert.$$
      fi
    else
      cert="$cert\n$line"
    fi
  done < "$(dsas_ca_file)"

}

dsas_ca_file() {
  for f in "/etc/ssl/ca-bundle.crt" "/etc/ssl/ca-certificates.crt" "/usr/local/etc/ssl/ca-bundle.crt" "/ust/local/etc/ssl/ca-certificates.crt"; do
    if [ -f "$f" ]; then
      echo $f
      return
    fi
  done
}
