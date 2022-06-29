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

all: Gpg.pub goodsign.gpg goodclear.asc gooddetach.sig gooddetachclear.asc unsigned bad.gpg virus.asc install

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

goodsign.gpg:
	echo "Gpg signed file" > goodsign
	rm -f goodsign.gpg
	gpg --pinentry-mode loopback --passphrase-file=passphrase --local-user test.user@example.com --sign goodsign
	rm -f goodsign

goodclear.asc:
	echo "Gpg clear signed file" > goodclear
	rm -f goodclear.asc
	gpg --pinentry-mode loopback --passphrase-file=passphrase --local-user test.user@example.com --clearsign goodclear
	rm -f goodclear

gooddetach.sig:
	echo "Gpg detached signed file" > gooddetach
	rm -f goddetach.sig
	gpg --pinentry-mode loopback --passphrase-file=passphrase --local-user test.user@example.com --detach-sig gooddetach

gooddetachclear.asc:
	echo "Gpg clear detached signed file" > gooddetachclear
	rm -f gooddetachclear.asc
	gpg --pinentry-mode loopback --passphrase-file=passphrase --local-user test.user@example.com -a --detach-sig gooddetachclear

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
	cp ../eicar virus
	gpg --pinentry-mode loopback --passphrase-file=passphrase -a --detach-sig virus

install: Gpg.pub goodsign.gpg goodclear.asc gooddetach.sig gooddetachclear.asc unsigned bad.gpg virus.asc	
	$(eval id:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))	
	$(eval finger:=$(shell gpg -v Gpg.pub 2> /dev/null | head -2 | tail -1 | xargs))
	$(eval t:=$(shell echo '$(subst $(newline),\n,$(task))'))
	$(eval c:=$(shell echo '$(subst $(newline),\n,$(cert))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} Gpg.pub
	mkdir -p ${HAUT}/Gpg
	cp -f goodsign.gpg goodclear.asc gooddetach gooddetach.sig gooddetachclear gooddetachclear.asc \
	   unsigned bad.gpg virus virus.asc ${HAUT}/Gpg

clean:
	rm -f Gpg.pub sign goodsign.gpg goodclear goodclear.asc gooddetach gooddetach.sig
	rm -f gooddetachclear gooddetachclear.asc unsigned bad bad.gpg
	rm -f virus virus.asc passphrase 
