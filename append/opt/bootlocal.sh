#!/bin/sh
# put other system startup commands here
/usr/local/sbin/initsshd /usr/local/etc/ssh
(/usr/local/etc/init.d/openssh start >> /var/log/sshd.log 2>&1)&
