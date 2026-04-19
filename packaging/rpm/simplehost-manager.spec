Name:           simplehost-manager
Version:        %{version}
Release:        1%{?dist}
Summary:        SimpleHost Manager release bundle
License:        Proprietary
BuildArch:      noarch
Source0:        %{name}-%{version}.tar.gz

Requires:       nodejs
Requires(post): systemd
Requires(postun): systemd

%description
Prebuilt SimpleHost Manager release bundle for installation under /opt/simplehostman/release.

%prep
%setup -q -n %{name}-%{version}

%build
# Release bundle is prebuilt.

%install
mkdir -p %{buildroot}/opt/simplehostman/release/releases/%{version}
cp -a . %{buildroot}/opt/simplehostman/release/releases/%{version}
mkdir -p %{buildroot}/etc/systemd/system
cp packaging/systemd/shm-agent.service %{buildroot}/etc/systemd/system/
mkdir -p %{buildroot}/etc/shm
cp packaging/env/shm-agent.env.example %{buildroot}/etc/shm/

%post
ln -sfn /opt/simplehostman/release/releases/%{version} /opt/simplehostman/release/current
%systemd_post shm-agent.service

%postun
%systemd_postun_with_restart shm-agent.service

%files
/opt/simplehostman/release/releases/%{version}
/etc/systemd/system/shm-agent.service
/etc/shm/shm-agent.env.example
