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
    with settings(warn_only=True):
        sudo("rm /etc/apache2/sites-enabled/000-default")
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


def cleanup(keep_num=5):
    """Remove older releases, keeping the last `keep_num` intact."""

    keep_num = int(keep_num)
    assert keep_num > 0, "[ERROR] keep_num must be > 0; refusing to proceed."

    with cd("%(path)s/packages" % env):
        package_files = sorted(run("ls -1").split())
        package_files = [_.replace(".tar.gz", "") for _ in package_files]

    with cd("%(path)s/releases" % env):
        release_files = sorted(run("ls -1").split())
        release_files.remove('current')

    diff = set(package_files).symmetric_difference(set(release_files))

    if diff:
        raise Exception("[ERROR]: Package and release directories are out of sync;"
                " refusing to proceed. Please fix this difference manually: %s" % diff)

    package_files = package_files[:-keep_num]
    release_files = release_files[:-keep_num]

    with cd("%(path)s/packages" % env):
        [sudo("rm %s.tar.gz" % _) for _ in package_files]

    with cd("%(path)s/releases" % env):
        [sudo("rm -r %s" % _) for _ in release_files]
