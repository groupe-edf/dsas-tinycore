Name:		#template#
Version:	1
Release:	1
Summary:	DSAS #template# test rpm
License:	None
BuildArch:	noarch

%description
A simple rpm package, that does nothing

%prep
# No source nothing to do

%build
cat > #template#.txt << EOF
Repomd #template# test file
EOF

%install
mkdir -p %{buildroot}/usr/local/share/dsas/tests
install -m 755 #template#.txt %{buildroot}/usr/local/share/dsas/tests

%files
/usr/local/share/dsas/tests/#template#.txt

%changelog
* Mon Jun 27 2022 David.Bateman@edf.fr
First version 
