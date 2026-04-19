Name:           simplehost-agent
Version:        %{version}
Release:        1%{?dist}
Summary:        SimpleHost agent release bundle
License:        Proprietary
BuildArch:      noarch
Source0:        %{name}-%{version}.tar.gz

Requires:       nodejs
Requires(post): systemd
Requires(postun): systemd

%description
Prebuilt SimpleHost agent release bundle for installation under /opt/simplehostman/release.

%prep
%setup -q -n %{name}-%{version}

%build
# Release bundle is prebuilt.

%install
mkdir -p %{buildroot}/opt/simplehostman/release/releases/%{version}
cp -a . %{buildroot}/opt/simplehostman/release/releases/%{version}
mkdir -p %{buildroot}/etc/systemd/system
cp packaging/systemd/simplehost-agent.service %{buildroot}/etc/systemd/system/
mkdir -p %{buildroot}/etc/simplehost
cp packaging/env/simplehost-agent.env.example %{buildroot}/etc/simplehost/

%post
ln -sfn /opt/simplehostman/release/releases/%{version} /opt/simplehostman/release/current
%systemd_post simplehost-agent.service

%postun
%systemd_postun_with_restart simplehost-agent.service

%files
/opt/simplehostman/release/releases/%{version}
/etc/systemd/system/simplehost-agent.service
/etc/simplehost/simplehost-agent.env.example
