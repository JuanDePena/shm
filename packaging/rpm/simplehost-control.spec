Name:           simplehost-control
Version:        %{version}
Release:        1%{?dist}
Summary:        SimpleHost control release bundle
License:        Proprietary
BuildArch:      noarch
Source0:        %{name}-%{version}.tar.gz

Requires:       nodejs
Requires(post): systemd
Requires(postun): systemd

%description
Prebuilt SimpleHost control release bundle for installation under /opt/simplehostman/release.

%prep
%setup -q -n %{name}-%{version}

%build
# Release bundle is prebuilt.

%install
mkdir -p %{buildroot}/opt/simplehostman/release/releases/%{version}
cp -a . %{buildroot}/opt/simplehostman/release/releases/%{version}
mkdir -p %{buildroot}/etc/systemd/system
cp packaging/systemd/simplehost-control.service %{buildroot}/etc/systemd/system/
cp packaging/systemd/simplehost-worker.service %{buildroot}/etc/systemd/system/
mkdir -p %{buildroot}/etc/simplehost
cp packaging/env/simplehost-control.env.example %{buildroot}/etc/simplehost/
cp packaging/env/simplehost-worker.env.example %{buildroot}/etc/simplehost/

%post
ln -sfn /opt/simplehostman/release/releases/%{version} /opt/simplehostman/release/current
%systemd_post simplehost-control.service
%systemd_post simplehost-worker.service

%postun
%systemd_postun_with_restart simplehost-control.service
%systemd_postun_with_restart simplehost-worker.service

%files
/opt/simplehostman/release/releases/%{version}
/etc/systemd/system/simplehost-control.service
/etc/systemd/system/simplehost-worker.service
/etc/simplehost/simplehost-control.env.example
/etc/simplehost/simplehost-worker.env.example
