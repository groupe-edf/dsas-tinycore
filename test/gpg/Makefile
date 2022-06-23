ifndef BASE
BASE :=  /tmp
endif

XMLFILE := ${BASE}/dsas_conf.xml
HAUT := ${BASE}/share/tests

define newline


endef

define task
    <task>
      <name>Gpg</name>
      <id>${id}</id>
      <directory>tests/Gpg</directory>
      <uri />
      <type>gpg</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>Gpg</name>
        <fingerprint>${finger}</fingerprint>
      </cert>
    </task>
endef

define cert
    <certificate>
      <type>gpg</type>
      <name>Gpg</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef	

all: Gpg.pub sign.gpg clear.asc detach.sig detachclear.asc unsigned bad.gpg virus.asc install

Gpg.pub:
	mkdir -p ${HOME}/.gnupg
	chmod go-rwx ${HOME}/.gnupg
	echo "no-allow-external-cache" >> ${HOME}/.gnupg/gpg-agent.conf
	gpg --batch --gen-key gpg.batch
	rm -f Gpg.pub
	gpg --output Gpg.pub --armor --export test.user@example.com
	grep "Passphrase:" gpg.batch | cut -d: -f2 | xargs > passphrase
	chmod go-rwx passphrase
	echo "no-allow-external-cache" >> ${HOME}/.gnupg/gpg-agent.conf

sign.gpg:
	echo "Gpg signed file" > sign
	rm -f sign.gpg
	gpg --pinentry-mode loopback --passphrase-file=passphrase --sign sign
	rm -f sign

clear.asc:
	echo "Gpg clear signed file" > clear
	rm -f clear.asc
	gpg --pinentry-mode loopback --passphrase-file=passphrase --clearsign clear
	rm -f clear

detach.sig:
	echo "Gpg detached signed file" > detach
	rm -f detach.sig
	gpg --pinentry-mode loopback --passphrase-file=passphrase --detach-sig detach

detachclear.asc:
	echo "Gpg clear detached signed file" > detachclear
	rm -f detachclear.asc
	gpg --pinentry-mode loopback --passphrase-file=passphrase -a --detach-sig detachclear

unsigned:
	echo "Usigned file" > unsigned

bad.gpg:
	echo "Gpg bad signature test file" > bad
	rm -f bad.gpg
	gpg --pinentry-mode loopback --passphrase-file=passphrase --sign bad
	# Modify 3 bytes in the middle of the file
	printf '\x11\x11\x11' | dd of=bad.gpg bs=1 seek=80 count=3 conv=notrunc
	rm -f bad

virus.asc: 
	rm -f virus.asc
	# Echo EICAR virus test to file
	echo "X50!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*" >  virus
	gpg --pinentry-mode loopback --passphrase-file=passphrase --clearsign virus 
	rm -f virus

install: Gpg.pub sign.gpg clear.asc detach.sig detachclear.asc unsigned bad.gpg virus.asc	
	$(eval id:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))
	$(eval finger:=$(shell sed -n '2,13p' Gpg.pub | sed -e "s:\s+::g" | base64 -d | sha256sum | cut -f1 -d' '))
	$(eval t:=$(shell echo '$(subst $(newline),\n,$(task))'))
	$(eval c:=$(shell echo '$(subst $(newline),\n,$(cert))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} Gpg.pub
	mkdir -p ${HAUT}/Gpg
	cp -f sign.gpg clear.asc detach detach.sig detachclear detachclear.asc \
	   unsigned bad.gpg virus.asc ${HAUT}/Gpg

clean:
	rm -f Gpg.pub sign sign.gpg clear clear.asc detach detach.sig
	rm -f detachclear detachclear.asc unsigned bad bad.gpg
	rm -f virus virus.asc passphrase 
