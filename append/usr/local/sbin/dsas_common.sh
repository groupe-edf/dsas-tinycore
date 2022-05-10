#! /bin/sh

VAR="/var/dsas"
LOG="/home/dsas/log"
CONF="$VAR/dsas_conf.xml.active"
RUNLOG="$LOG/dsas_runlog"
DSAS_HOME="/home/dsas"

# Hotnames listed in /etc/hosts for "bas and "haut"
INTERCO_HAUT="haut"

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

myecho(){
  [ $verbose -ne 0 ] && echo $@
  # If not verbose the status will be 1. explicitly return 0
  return 0
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

# Usage get_certificate fingerprint
get_certificate(){
  local cert type
  local i=1
  local incert="false"
  local ca_bundle=$(dsas_ca_file)
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
        echo "error parsing $ca_bundle"
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
  done < "$ca_bundle"

}

dsas_ca_file() {
  for f in "/etc/ssl/ca-bundle.crt" "/etc/ssl/ca-certificates.crt" "/usr/local/etc/ssl/ca-bundle.crt" "/ust/local/etc/ssl/ca-certificates.crt"; do
    if [ -f "$f" ]; then
      echo $f
      return
    fi
  done
}
