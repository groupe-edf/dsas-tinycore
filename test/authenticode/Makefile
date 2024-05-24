ifndef BASE
BASE :=  /tmp
endif

XMLFILE := ${BASE}/dsas_conf.xml
HAUT := ${BASE}/share/tests

define newline


endef

define task
    <task>
      <name>Authenticode</name>
      <id>${id}</id>
      <directory>tests/Authenticode</directory>
      <uri />
      <type>authenticode</type>
      <run>never</run>
      <ca><fingerprint /><name /></ca>
      <cert>
        <name>MyCert</name>
        <fingerprint>${finger}</fingerprint>
      </cert>
    </task>
endef

define cert
    <certificate>
      <type>x509</type>
      <name>MyCert</name>
      <pem></pem>
      <authority>true</authority>
    </certificate>
endef	

all: MyCert.pem good.cab bad.cab virus.cab unsigned.cab
	$(eval id:=$(shell < /dev/random tr -dc a-f0-9 | head -c "24"; echo;))
	$(eval len:=$(shell cat MyCert.pem | wc -l))                    
	$(eval len:=$(shell echo $$(($(len)-1)) ))   
	$(eval finger:=$(shell sed -n '2,$(len)p' MyCert.pem | sed -e "s:\s+::g" | base64 -d | sha256sum | cut -f1 -d' '))
	$(eval t:=$(shell echo '$(subst $(newline),\n,$(task))'))
	$(eval c:=$(shell echo '$(subst $(newline),\n,$(cert))'))
	sed -i -e 's:<tasks>:<tasks>\n    ${t}:' ${XMLFILE}
	sed -i -e 's:<certificates>:<certificates>\n    ${c}:' ${XMLFILE}
	awk -i inplace 'BEGIN { while (getline < ARGV[2]) { pemcert = pemcert $$0 "\n" } delete ARGV[2]; } \
	  { if (/<pem><\/pem>/) { print "      <pem>" pemcert "</pem>"; } else { print $$0; }}' ${XMLFILE} MyCert.pem
	mkdir -p ${HAUT}/Authenticode
	cp -f good.cab bad.cab virus.cab unsigned.cab ${HAUT}/Authenticode

MyCert.key:
	openssl genrsa -out MyCert.key 4096

MyCert.pem: MyCert.key
	# FIXME : 'openssl req' doesn't  accept "-startdate' argument. So need 
	# to set the date to pre-date the CA certificate to avoid problems
	$(eval d0:=$(shell echo $$(($$(date +%s) - 7200)) ))
	sudo date -s '@$(d0)'
	yes '' | openssl req -x509 -nodes -key MyCert.key -extensions v3_ca -sha256 -days 180 -out MyCert.pem
	$(eval d0:=$(shell echo $$(($$(date +%s) + 7200)) ))
	sudo date -s '@$(d0)'

BadCert.key: 
	openssl genrsa -out BadCert.key 4096

BadCert.pem: BadCert.key
	$(eval d0:=$(shell echo $$(($$(date +%s) - 7200)) ))
	sudo date -s '@$(d0)'
	yes '' | openssl req -x509 -nodes -key BadCert.key -extensions v3_ca -sha256 -days 180 -out BadCert.pem
	$(eval d0:=$(shell echo $$(($$(date +%s) + 7200)) ))
	sudo date -s '@$(d0)'

good.cab: MyCert.pem 
	rm -f good.txt good-unsigned.cab good.cab
	echo "Authenticode test file" > good.txt
	lcab good.txt good-unsigned.cab
	osslsigncode sign -certs MyCert.pem -key MyCert.key -in good-unsigned.cab -out good.cab 
	rm -f good.txt good-unsigned.cab

bad.cab: BadCert.pem 
	rm -f bad.txt bad-unsigned.cab bad.cab
	echo "Authenticode bad test file" > bad.txt
	lcab bad.txt bad-unsigned.cab
	osslsigncode sign -certs BadCert.pem -key BadCert.key -in bad-unsigned.cab -out bad.cab 
	rm -f bad.txt bad-unsigned.cab

virus.cab: MyCert.pem 
	rm -f virus.txt virus-unsigned.cab virus.cab
	cp ../eicar virus.txt
	lcab virus.txt virus-unsigned.cab
	osslsigncode sign -certs MyCert.pem -key MyCert.key -in virus-unsigned.cab -out virus.cab 
	rm -f virus.txt virus-unsigned.cab

unsigned.cab: 
	rm -f unsigned.txt unsigned.cab 
	echo "Unsigned test file" > unsigned.txt
	lcab unsigned.txt unsigned.cab
	rm -f unsigned.txt

clean: 
	rm -f good.txt good-unsigned.cab good.cab bad.txt bad-unsigned.cab bad.cab 
	rm -f virus.txt virus-unsigned.cab virus.cab unsigned.txt usigned.cab
	rm -f MyCert.key MyCert.pem BadCert.key BadCert.pem
