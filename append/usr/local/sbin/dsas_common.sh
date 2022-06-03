#! /bin/sh
# shellcheck disable=SC2034

VAR="/var/dsas"
LOG="/home/dsas/log"
CONF="$VAR/dsas_conf.xml.active"
DSAS_HOME="/home/dsas"
DSAS_HAUT=$DSAS_HOME/haut/share
DSAS_BAS=$DSAS_HOME/bas/share

# Hostnames listed in /etc/hosts for "bas and "haut"
INTERCO_HAUT="haut"

if [ -f $VAR/dsas_typ ]; then
  TYP="$(cat "$VAR/dsas_typ")"
else
  TYP="haut"
fi
