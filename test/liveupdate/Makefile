ifndef BASE
BASE :=  /tmp
endif

XMLFILE := ${BASE}/dsas_conf.xml
HAUT := ${BASE}/share/tests

define newline


endef

define task
    <task>
      <name>LiveUpdate</name>
      <id>${id}</id>
      <directory>tests/LiveUpdate</directory>
      <uri />
      <type>liveupdate</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>MyLUCert</name>
        <fingerprint>${finger}</fingerprint>
      </cert>
    </task>
endef

define cert
    <certificate>
      <type>x509</type>
      <name>MyLUCert</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef	

all: good-livetri.zip install

MyLUCert.key:
	openssl genrsa -out MyLUCert.key 4096

MyLUCert.pem: MyLUCert.key
	yes '' | openssl req -x509 -nodes -key MyLUCert.key -extensions v3_ca -sha256 -days 180 -out MyLUCert.pem

BadLUCert.key: 
	openssl genrsa -out BadLUCert.key 4096

BadLUCert.pem: BadLUCert.key
	yes '' | openssl req -x509 -nodes -key BadLUCert.key -extensions v3_ca -sha256 -days 180 -out BadLUCert.pem

good-livetri.zip: MyLUCert.pem
	rm -f liveupdt.grd
	echo "Liveupdate test file" > good.txt
	$(eval sha1:=$(shell echo "Liveupdate test file" | sha1sum | cut -f1 -d' ' | xargs))
	$(eval sha256:=$(shell echo "Liveupdate test file" | sha256sum | cut -f1 -d' ' | xargs))
	echo "[File-good.txt]" >> liveupdt.grd
	echo "SHA1=$(sha1)" >> liveupdt.grd
	echo "SHA256=$(sha256)" >> liveupdt.grd
	echo "Liveupdate embedded test file" > embed.txt
	$(eval sha1:=$(shell echo "Liveupdate embedded test file" | sha1sum | cut -f1 -d' ' | xargs))
	$(eval sha256:=$(shell echo "Liveupdate embedded test file" | sha256sum | cut -f1 -d' ' | xargs))
	echo SHA: $(sha1) $(sha256)
	echo "[File-embed.txt]" >> liveupdt.grd
	echo "SHA1=$(sha1)" >> liveupdt.grd
	echo "SHA256=$(sha256)" >> liveupdt.grd
	cat MyLUCert.key MyLUCert.pem > signer.pem
	openssl cms -sign -in liveupdt.grd -outform DER -out liveupdt.sig -signer signer.pem
	zip good-livetri.zip embed.txt liveupdt.grd liveupdt.sig
	rm -f embed.txt liveupdt.grd liveupdt.sig signer.pem

bad-livetri.zip: BadLUCert.pem
	rm -f liveupdt.grd
	echo "Liveupdate bad test file" > bad.txt
	$(eval sha1:=$(shell echo "Liveupdate bad test file" | sha1sum | cut -f1 -d' ' | xargs))
	$(eval sha256:=$(shell echo "Liveupdate bad test file" | sha256sum | cut -f1 -d' ' | xargs))
	echo "[File-bad.txt]" >> liveupdt.grd
	echo "SHA1=$(sha1)" >> liveupdt.grd
	echo "SHA256=$(sha256)" >> liveupdt.grd
	echo "Liveupdate bad embedded test file" > embed.txt
	$(eval sha1:=$(shell echo "Liveupdate bad embedded test file" | sha1sum | cut -f1 -d' ' | xargs))
	$(eval sha256:=$(shell echo "Liveupdate bad embedded test file" | sha256sum | cut -f1 -d' ' | xargs))
	echo "[File-embed.txt]" >> liveupdt.grd
	echo "SHA1=$(sha1)" >> liveupdt.grd
	echo "SHA256=$(sha256)" >> liveupdt.grd
	cat BadLUCert.key BadLUCert.pem > signer.pem
	openssl cms -sign -in liveupdt.grd -outform DER -out liveupdt.sig -signer signer.pem
	zip bad-livetri.zip embed.txt liveupdt.grd liveupdt.sig
	rm -f embed.txt liveupdt.grd liveupdt.sig signer.pem

unsigned-livetri.zip:
	rm -f liveupdt.grd
	echo "Liveupdate unsigned test file" > unsigned.txt
	$(eval sha1:=$(shell echo "Liveupdate unsigned test file" | sha1sum | cut -f1 -d' ' | xargs))
	$(eval sha256:=$(shell echo "Liveupdate unsigned test file" | sha256sum | cut -f1 -d' ' | xargs))
	echo "[File-unsigned.txt]" >> liveupdt.grd
	echo "SHA1=$(sha1)" >> liveupdt.grd
	echo "SHA256=$(sha256)" >> liveupdt.grd
	echo "Liveupdate unsigned embedded test file" > embed.txt
	$(eval sha1:=$(shell echo "Liveupdate unsigned embedded test file" | sha1sum | cut -f1 -d' ' | xargs))
	$(eval sha256:=$(shell echo "Liveupdate unsigned embedded test file" | sha256sum | cut -f1 -d' ' | xargs))
	echo "[File-embed.txt]" >> liveupdt.grd
	echo "SHA1=$(sha1)" >> liveupdt.grd
	echo "SHA256=$(sha256)" >> liveupdt.grd
	zip unsigned-livetri.zip embed.txt liveupdt.grd 
	rm -f embed.txt liveupdt.grd

virus-livetri.zip: MyLUCert.pem
	rm -f liveupdt.grd
	cp ../eicar virus.txt
	$(eval sha1:=$(shell sha1sum ../eicar | cut -f1 -d' ' | xargs))
	$(eval sha256:=$(shell sha256sum ../eicar | cut -f1 -d' ' | xargs))
	echo "[File-virus.txt]" >> liveupdt.grd
	echo "SHA1=$(sha1)" >> liveupdt.grd
	echo "SHA256=$(sha256)" >> liveupdt.grd
	cp ../eicar embed.txt
	$(eval sha1:=$(shell sha1sum ../eicar | cut -f1 -d' ' | xargs))
	$(eval sha256:=$(shell sha256sum ../eicar | cut -f1 -d' ' | xargs))
	echo "[File-embed.txt]" >> liveupdt.grd
	echo "SHA1=$(sha1)" >> liveupdt.grd
	echo "SHA256=$(sha256)" >> liveupdt.grd
	cat MyLUCert.key MyLUCert.pem > signer.pem
	openssl cms -sign -in liveupdt.grd -outform DER -out liveupdt.sig -signer signer.pem
	zip virus-livetri.zip embed.txt liveupdt.grd liveupdt.sig
	rm -f embed.txt liveupdt.grd liveupdt.sig signer.pem
 
install: good-livetri.zip bad-livetri.zip unsigned-livetri.zip virus-livetri.zip MyLUCert.pem
	$(eval id:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))
	$(eval len:=$(shell cat MyLUCert.pem | wc -l))                    
	$(eval len:=$(shell echo $$(($(len)-1)) ))   
	$(eval finger:=$(shell sed -n '2,$(len)p' MyLUCert.pem | sed -e "s:\s+::g" | base64 -d | sha256sum | cut -f1 -d' '))
	$(eval t:=$(shell echo '$(subst $(newline),\n,$(task))'))
	$(eval c:=$(shell echo '$(subst $(newline),\n,$(cert))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} MyLUCert.pem
	mkdir -p ${HAUT}/LiveUpdate
	cp -f good.txt good-livetri.zip bad.txt bad-livetri.zip unsigned.txt unsigned-livetri.zip \
	   virus.txt virus-livetri.zip  ${HAUT}/LiveUpdate

clean:
	rm -f embed.txt liveupdt.grd liveupdt.sig good.txt good-livetri.zip
	rm -f bad.txt bad-livetri.zip unsigned.txt unsigned-livetri.zip signer.pem
	rm -f virus.txt virus-livetri.zip MyLUCert.key MyLUCert.pem BadLUCert.key BadLUCert.pem

