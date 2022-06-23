ifndef BASE
BASE :=  /tmp
endif

XMLFILE := ${BASE}/dsas_conf.xml
HAUT := ${BASE}/share/tests

define newline


endef

define task
    <task>
      <name>Openssl</name>
      <id>${id}</id>
      <directory>tests/Openssl</directory>
      <uri />
      <type>openssl</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>Openssl</name>
        <fingerprint>${finger}</fingerprint>
      </cert>
    </task>
endef

define cert
    <certificate>
      <type>pubkey</type>
      <name>Openssl</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef	

all: good.txt bad.txt virus.txt unsigned.txt install

OpensslPriv.pem:
	openssl genrsa -out OpensslPriv.pem 4096

BadOpensslPriv.pem:
	openssl genrsa -out BadOpensslPriv.pem 4096

Openssl.pem: OpensslPriv.pem
	openssl rsa -in OpensslPriv.pem -pubout > Openssl.pem

good.txt: OpensslPriv.pem
	rm -f good.txt good.txt.sig
	echo "Openssl test file" > good.txt
	openssl dgst -sign OpensslPriv.pem -keyform PEM -sha256 -out good.txt.sig -binary good.txt

bad.txt: BadOpensslPriv.pem
	rm -f bad.txt bad.txt.sig
	echo "Openssl bad test file" > bad.txt
	openssl dgst -sign BadOpensslPriv.pem -keyform PEM -sha256 -out bad.txt.sig -binary bad.txt

virus.txt: OpensslPriv.pem
	rm -f virus.txt virus.txt.sig
	cp ../eicar virus.txt
	openssl dgst -sign OpensslPriv.pem -keyform PEM -sha256 -out virus.txt.sig -binary virus.txt

unsigned.txt: 
	rm -f unsigned.txt 
	echo "Unsigned test file" > unsigned.txt

install: good.txt bad.txt virus.txt unsigned.txt Openssl.pem
	$(eval id:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))
	$(eval finger:=$(shell sed -n '2,13p' Openssl.pem | sed -e "s:\s+::g" | base64 -d | sha256sum | cut -f1 -d' '))
	$(eval t:=$(shell echo '$(subst $(newline),\n,$(task))'))
	$(eval c:=$(shell echo '$(subst $(newline),\n,$(cert))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} Openssl.pem
	mkdir -p ${HAUT}/Openssl
	cp -f good.txt good.txt.sig bad.txt bad.txt.sig virus.txt virus.txt.sig unsigned.txt  ${HAUT}/Openssl

clean: 
	rm -f good.txt good.txt.sig bad.txt bad.txt.sig virus.txt virus.txt.sig
	rm -f unsigned.txt Openssl.pem OpensslPriv.pem BadOpensslPriv.pem

