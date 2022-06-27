Name:		virus
Version:	1
Release:	1
Summary:	DSAS virus test rpm
License:	None
BuildArch:	noarch

%description
A simple rpm package, that does nothing

%prep
# No source nothing to do

%build
cat > virus.txt << EOF
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
EOF

%install
mkdir -p %{buildroot}/usr/local/share/dsas/tests
install -m 755 virus.txt %{buildroot}/usr/local/share/dsas/tests

%files
/usr/local/share/dsas/tests/virus.txt

%changelog
* Mon Jun 27 2022 David.Bateman@edf.fr
First version 
