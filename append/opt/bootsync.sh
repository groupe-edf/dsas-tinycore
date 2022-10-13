#!/bin/sh
# put other system startup commands here, the boot process will wait until they complete.
# Use bootlocal.sh for system startup commands that can run in the background 
# and therefore not slow down the boot process.
sysctl -p /etc/sysctl.conf > /dev/null 2>&1
/etc/init.d/services/dsas start
/opt/bootlocal.sh &
