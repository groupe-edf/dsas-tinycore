#!/bin/sh
# put other system startup commands here, the boot process will wait until they complete.
# Use bootlocal.sh for system startup commands that can run in the background 
# and therefore not slow down the boot process.
/etc/init.d/services/dsas start
/usr/local/sbin/saslauthd -a shadow &
/opt/bootlocal.sh &
