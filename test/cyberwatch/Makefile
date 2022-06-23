ifndef BASE
BASE :=  /tmp
endif

XMLFILE := ${BASE}/dsas_conf.xml
HAUT := ${BASE}/share/tests

define newline


endef

define task
    <task>
      <name>Fake CyberWatch</name>
      <id>${id}</id>
      <directory>tests/Cyberwatch</directory>
      <uri />
      <type>cyberwatch</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>Fake Cyberwatch</name>
        <fingerprint>${finger}</fingerprint>
      </cert>
    </task>
endef

define cert
    <certificate>
      <type>pubkey</type>
      <name>Fake CyberWatch</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef	

all: good.zip bad.zip virus.zip unsigned.zip install

FakeCyberWatchPriv.pem:
	openssl genrsa -out FakeCyberWatchPriv.pem 4096

BadCyberWatchPriv.pem:
	openssl genrsa -out BadCyberWatchPriv.pem 4096

FakeCyberWatch.pem: FakeCyberWatchPriv.pem
	openssl rsa -in FakeCyberWatchPriv.pem -pubout > FakeCyberWatch.pem

good.zip: FakeCyberWatchPriv.pem
	rm -f cyberwatch.db cyberwatch.db.sha256 cyberwatch.sig
	echo "Fake cyberwatch signature file" > cyberwatch.db
	head -c -1 cyberwatch.db | sha256sum | cut -f1 -d' ' | tr -d '\n' > cyberwatch.db.sha256
	openssl dgst -sign FakeCyberWatchPriv.pem -keyform PEM -sha256 -out cyberwatch.sig cyberwatch.db.sha256
	echo "" >> cyberwatch.sig
	zip good.zip cyberwatch.db cyberwatch.sig
	rm -f cyberwatch.db cyberwatch.db.sha256 cyberwatch.sig

bad.zip: BadCyberWatchPriv.pem
	rm -f cyberwatch.db cyberwatch.db.sha256 cyberwatch.sig
	echo "Fake cyberwatch signature file" > cyberwatch.db
	head -c -1 cyberwatch.db | sha256sum | cut -f1 -d' ' | tr -d '\n' > cyberwatch.db.sha256
	openssl dgst -sign BadCyberWatchPriv.pem -keyform PEM -sha256 -out cyberwatch.sig cyberwatch.db.sha256
	echo "" >> cyberwatch.sig
	zip bad.zip cyberwatch.db cyberwatch.sig
	rm -f cyberwatch.db cyberwatch.db.sha256 cyberwatch.sig

virus.zip: FakeCyberWatchPriv.pem
	rm -f cyberwatch.db cyberwatch.db.sha256 cyberwatch.sig
	cp ../eicar cyberwatch.db 
	head -c -1 cyberwatch.db | sha256sum | cut -f1 -d' ' | tr -d '\n' > cyberwatch.db.sha256
	openssl dgst -sign FakeCyberWatchPriv.pem -keyform PEM -sha256 -out cyberwatch.sig cyberwatch.db.sha256
	echo "" >> cyberwatch.sig
	zip virus.zip cyberwatch.db cyberwatch.sig
	rm -f cyberwatch.db cyberwatch.db.sha256 cyberwatch.sig

unsigned.zip: 
	rm -f cyberwatch.db cyberwatch.db.sha256 cyberwatch.sig
	echo "1Fake cyberwatch signature file" > cyberwatch.db
	zip unsigned.zip cyberwatch.db
	rm -f cyberwatch.db cyberwatch.db.sha256 cyberwatch.sig

install: good.zip bad.zip virus.zip unsigned.zip FakeCyberWatch.pem
	$(eval id:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))
	$(eval finger:=$(shell sed -n '2,13p' FakeCyberWatch.pem | sed -e "s:\s+::g" | base64 -d | sha256sum | cut -f1 -d' '))
	$(eval t:=$(shell echo '$(subst $(newline),\n,$(task))'))
	$(eval c:=$(shell echo '$(subst $(newline),\n,$(cert))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} FakeCyberWatch.pem
	mkdir -p ${HAUT}/Cyberwatch
	cp -f good.zip bad.zip unsigned.zip virus.zip ${HAUT}/Cyberwatch

clean: 
	rm -f good.zip bad.zip virus.zip unsigned.zip cyberwatch.db 
	rm -f cyberwatch.db.sha256 cyberwatch.zip temp.sig cyberwatch.sig
	rm -f FakeCyberWatch.pem FakeCyberWatchPriv.pem BadCyberWatchPriv.pem

