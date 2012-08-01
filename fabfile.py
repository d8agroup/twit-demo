import time
from fabric.api import *


def production():
    pass


def staging():
    env.hosts = ['localhost']
    env.path = "/usr/local/metaLayer-twit-demo"


def setup():
    """Setup a host for proper deployment. Assuming Debian Linux."""

    debs = ("python-setuptools", "apache2", "libapache2-mod-wsgi")

    require("hosts", provided_by=[production, staging])
    sudo("apt-get install %s" % " ".join(debs))
    sudo("easy_install virtualenv pip")
    sudo("mkdir -p %(path)s" % env)
    with cd("%(path)s" % env):
        sudo("mkdir -p releases; mkdir -p packages")
        sudo("virtualenv --no-site-packages .")
    sudo("mkdir -p /var/log/twit-demo; chown www-data:www-data /var/log/twit-demo")


def deploy():
    """Deploy a new relase."""
    require("hosts", provided_by=[production, staging])
    env.release = time.strftime("%Y-%m-%d_%H:%M:%S")
    upload_tar_from_git()
    install_requirements()
    setup_webserver()
    symlink_current_release()
    restart_webserver()


def upload_tar_from_git():
    """Create an archive from the given tree, upload, and untar it."""
    require("release", provided_by=[deploy])
    tree = prompt("Please enter a branch or SHA1 to deploy", default="master")
    local("git archive --format=tar %s | gzip > %s.tar.gz" % (tree, env['release']))
    sudo("mkdir %(path)s/releases/%(release)s" % env)
    put("%(release)s.tar.gz" % env, "%(path)s/packages/" % env, use_sudo=True)
    sudo("cd %(path)s/releases/%(release)s && tar zxf ../../packages/%(release)s.tar.gz" % env)
    local("rm %(release)s.tar.gz" % env)


def install_requirements():
    """Install the required Python packages inside the virtualenv."""
    require("release", provided_by=[deploy])
    with cd("%(path)s" % env):
        sudo("./bin/pip install -r ./releases/%(release)s/requirements.txt" % env)


def setup_webserver():
    require("release", provided_by=[deploy])
    sudo("a2enmod headers")
    sudo("rm /etc/apache2/sites-enabled/*")
    with cd("%(path)s/releases/%(release)s" % env):
        put("assets/apache2/vhost", "/etc/apache2/sites-enabled/metaLayer-twit-demo", use_sudo=True)


def symlink_current_release():
    """Symlink to the new current release."""
    require("release", provided_by=[deploy])
    with cd("%(path)s/releases" % env):
        sudo("ln -s %(release)s current_tmp && mv -Tf current_tmp current" % env)


def restart_webserver():
    """Restart the webserver."""
    require("hosts", provided_by=[production, staging])
    sudo("service apache2 restart")
