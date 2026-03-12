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
Prebuilt SimpleHost Manager release bundle for installation under /opt/simplehost/shm.

%prep
%setup -q -n %{name}-%{version}

%build
# Release bundle is prebuilt.

%install
mkdir -p %{buildroot}/opt/simplehost/shm/releases/%{version}
cp -a . %{buildroot}/opt/simplehost/shm/releases/%{version}
mkdir -p %{buildroot}/etc/systemd/system
cp packaging/systemd/shm-agent.service %{buildroot}/etc/systemd/system/
mkdir -p %{buildroot}/etc/shm
cp packaging/env/shm-agent.env.example %{buildroot}/etc/shm/

%post
ln -sfn /opt/simplehost/shm/releases/%{version} /opt/simplehost/shm/current
%systemd_post shm-agent.service

%postun
%systemd_postun_with_restart shm-agent.service

%files
/opt/simplehost/shm/releases/%{version}
/etc/systemd/system/shm-agent.service
/etc/shm/shm-agent.env.example
