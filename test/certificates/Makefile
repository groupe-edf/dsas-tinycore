ifndef BASE
BASE :=  /tmp
endif

all: Gpg.pub Openssl.pem X509.pem
	mkdir -p ${BASE}/Certificates
	cp -f Gpg.pub Openssl.pem X509.pem ${BASE}/Certificates

Gpg.pub:
	mkdir -p ${HOME}/.gnupg
	chmod go-rwx ${HOME}/.gnupg
	echo "no-allow-external-cache" >> ${HOME}/.gnupg/gpg-agent.conf
	gpg --batch --gen-key gpg.batch
	rm -f Gpg.pub
	gpg --output Gpg.pub --armor --export certs@example.com
	grep "Passphrase:" gpg.batch | cut -d: -f2 | xargs > passphrase
	chmod go-rwx passphrase

OpensslPriv.pem:
	openssl genrsa -out OpensslPriv.pem 4096

Openssl.pem: OpensslPriv.pem
	openssl rsa -in OpensslPriv.pem -pubout > Openssl.pem

X509.pem : OpensslPriv.pem
	yes '' | openssl req -x509 -nodes -key OpensslPriv.pem -extensions v3_ca -sha256 -days 180 -out X509.pem

clean:
	rm -f Gpg.pub OpebsslPriv.pem Openssl.pem X509.pem