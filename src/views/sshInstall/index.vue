<template>
  <div class="ssh-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="ssh-header">
        OpenSSH 是安全 Shell (SSH) 工具的开放源代码版本，Linux 及其他非 Windows
        系统的管理员使用此类工具跨平台管理远程系统；OpenSSH 在 2018 年秋季已添加至
        Windows，并包含在 Windows 10 和 Windows Server 2019 中。 大多数 Linux
        发行版默认都包含 OpenSSH 客户端和服务器软件包，允许使用 SSH
        进行安全的远程登录和文件传输，此处不再介绍。
      </div>
    </el-card>
    <el-card shadow="never" class="mb15">
      <template #header>
        <div class="ssh-header-title">方式一：使用 Windows 设置来安装 OpenSSH</div>
      </template>
      <div class="ssh-content">
        <div class="ssh-info-text">
          注：适用于 Windows Server 2019 和 Windows 10(2018秋季之后发行的版本) 设备上的
          Windows 设置安装这两个 OpenSSH 组件。
        </div>
        <p class="ssh-info-img">
          <el-image
            :src="openSsh"
            title="点击预览"
            :zoom-rate="1.2"
            :max-scale="7"
            :min-scale="0.2"
            :preview-src-list="[openSsh]"
            :initial-index="4"
            fit="fill"
          />
        </p>
        <p class="ssh-info-text mb5">
          <code>
            # 开启服务命令 <br />
            net start sshd <br /><br /># 关闭服务<br />
            net stop sshd <br /><br />
            # 默认端口<br />22
          </code>
        </p>
        <p class="ssh-info-text mb5">
          OpenSSH离线安装包下载：<a
            class="ssh-link-download"
            href="https://github.com/PowerShell/Win32-OpenSSH/tags"
            target="_blank"
          >
            https://github.com/PowerShell/Win32-OpenSSH/tags </a
          >，推荐下载v9.8.x版本(较为稳定)，下载完成后，双击安装包即可安装 OpenSSH。
        </p>
        <p class="ssh-info-text mb5">
          安装 <b>OpenSSH</b> 服务器将创建并启用一个名为 <b>OpenSSH-Server-In-TCP</b>
          的防火墙规则，这允许端口 22 上的入站 SSH 流量，
          如果未启用此规则且未打开此端口，那么连接将被拒绝或重置。
        </p>
      </div>
    </el-card>
    <el-card shadow="never" class="mb15">
      <template #header>
        <div class="ssh-header-title">方式二：使用 PowerShell 安装 OpenSSH</div></template
      >
      <div class="ssh-content">
        <div class="ssh-info-text mb5">
          注：适用于 Windows Server 2019 和 Windows 10(2018秋季之后发行的版本) 设备上的
          Windows 设置安装这两个 OpenSSH 组件。
        </div>
        <p class="ssh-info-text mb5">
          <code>
            # 若要使用 PowerShell 安装
            OpenSSH，请先以管理员身份运行PowerShell(win+x快捷键进行打开)。为了确保 OpenSSH
            可用，请运行以下cmd命令：<br />
            Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*'
          </code>
          <br /><br />
          <code>
            # 如果两者均尚未安装，则此操作应返回以下输出：<br />
            Name : OpenSSH.Client~~~~0.0.1.0 <br />State : NotPresent <br /><br />Name :
            OpenSSH.Server~~~~0.0.1.0 <br />State : NotPresent
          </code>
          <br /><br />
          <code>
            # 然后，根据需要安装服务器或客户端组件<br />
            Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
            <br />
            Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
          </code>
          <br /><br />
          <code>
            # 这两者应该都会返回以下输出： <br />Path : <br />Online : True
            <br />RestartNeeded : False
          </code>
          <br /><br />
          <code>
            # 启动 SSH 服务<br />
            Start-Service sshd<br />
            <br />
            # 可选，但建议使用<br />
            Set-Service -Name sshd -StartupType 'Automatic'
          </code>
        </p>
      </div>
    </el-card>
    <el-card shadow="never" class="mb15">
      <template #header>
        <div class="ssh-header-title">方式三：下载OpenSSH安装包进行安装</div></template
      >
      <div class="ssh-content">
        <div class="ssh-info-text mb5">
          注：适用于(除Windows 2000、XP 或 2003外)所有版本，安装时请选择合适的安装包版本。
        </div>
        <p>
          OpenSSH下载地址：<a
            href="https://www.mls-software.com/opensshd.html"
            target="_blank"
            >https://www.mls-software.com/opensshd.html</a
          >
        </p>
        <p class="ssh-info-img">
          <el-image
            :src="threeOpenssh01"
            title="点击预览"
            :zoom-rate="1.2"
            :max-scale="7"
            :min-scale="0.2"
            :preview-src-list="threeImgList"
            :initial-index="0"
            fit="fill"
          />
        </p>
        <p>
          若系统为Windows 2000、XP 或 2003，请选择：
          <a href="https://www.mls-software.com/opensshd-old-cygwin.html" target="_blank"
            >https://www.mls-software.com/opensshd-old-cygwin.html</a
          >。
        </p>
        <p class="ssh-info-img">
          <el-image
            :src="threeOpenssh02"
            title="点击预览"
            :zoom-rate="1.2"
            :max-scale="7"
            :min-scale="0.2"
            :preview-src-list="threeImgList"
            :initial-index="1"
            fit="fill"
          />
        </p>
        <p class="ssh-info-text mb5">
          客户端：安装ssh客户端命令行工具(如果您想连接到其他ssh服务器)<br />
          服务器端：安装ssh服务器命令行应用程序(如果您想为其他人提供一个ssh服务器来连接)
        </p>
        <p class="ssh-info-img">
          <el-image
            :src="threeOpenssh03"
            title="点击预览"
            :zoom-rate="1.2"
            :max-scale="7"
            :min-scale="0.2"
            :preview-src-list="threeImgList"
            :initial-index="2"
            fit="fill"
          />
        </p>
        <p class="ssh-info-text mb5">
          <b>注意：</b
          >需要解释的屏幕是“选择执行SSHD的帐户”，SSH守护程序(SSHD)可以作为Local_System或SSHD_Server运行，如果您使用的是Windows
          Server(2003/2008/2008R2/等)，您可能必须将其作为SSHD_Server运行，但所有其他服务器都应该能够将其作为Local_System运行。
          ​<br /><b>此密码不是连接ssh服务时的密码。</b>
        </p>
        <p class="ssh-info-img">
          <el-image
            :src="threeOpenssh04"
            title="点击预览"
            :zoom-rate="1.2"
            :max-scale="7"
            :min-scale="0.2"
            :preview-src-list="threeImgList"
            :initial-index="3"
            fit="fill"
          />
        </p>
        <p class="ssh-info-text mb5">
          默认端口为22，若您更改其他端口后，连接时请添加 -p 端口
        </p>
        <p class="ssh-info-img">
          <el-image
            :src="threeOpenssh05"
            title="点击预览"
            :zoom-rate="1.2"
            :max-scale="7"
            :min-scale="0.2"
            :preview-src-list="threeImgList"
            :initial-index="4"
            fit="fill"
          />
        </p>
        <p class="ssh-info-text mb5">
          安装完成后，查看版本： <br />
          # 适用于OpenSSH 6.3及更低版本<br />
          ssh -v<br /><br />
          # 适用于OpenSSH 6.4及更高版本<br />
          ssh -V
        </p>
        <p class="ssh-info-img">
          <el-image
            :src="threeOpenssh06"
            title="点击预览"
            :zoom-rate="1.2"
            :max-scale="7"
            :min-scale="0.2"
            :preview-src-list="threeImgList"
            :initial-index="5"
            fit="fill"
          />
        </p>
        <p class="ssh-info-text mb5">
          启动SSH服务(以管理员身份运行)： <br />
          # 启动服务<br />
          net start opensshd<br /><br />
          # 关闭服务<br />
          net stop opensshd
        </p>
        <p class="ssh-info-img">
          <el-image
            :src="threeOpenssh07"
            title="点击预览"
            :zoom-rate="1.2"
            :max-scale="7"
            :min-scale="0.2"
            :preview-src-list="threeImgList"
            :initial-index="6"
            fit="fill"
          />
        </p>
        <p class="ssh-info-text mb5">
          提示：安装后程序会提示给默认密码，此密码不作为ssh连接时的登录密码，<b
            >连接密码为系统登录密码，连接名为系统当前账号名。</b
          ><br /><br />
          安装后，可从使用 PowerShell 安装了 OpenSSH 客户端的 Windows 10 或 Windows Server
          2019 设备连接到 OpenSSH 服务器，如下所示：<br />
          ssh username@servername <br /># 例如 <br />ssh Administrator@192.168.x.x
        </p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="sshInstall">
import { ref } from "vue";

import openSsh from "@/assets/openssh/open-ssh.png";
import threeOpenssh01 from "@/assets/openssh/three-openssh-01.png";
import threeOpenssh02 from "@/assets/openssh/three-openssh-02.png";
import threeOpenssh03 from "@/assets/openssh/three-openssh-03.png";
import threeOpenssh04 from "@/assets/openssh/three-openssh-04.png";
import threeOpenssh05 from "@/assets/openssh/three-openssh-05.png";
import threeOpenssh06 from "@/assets/openssh/three-openssh-06.jpg";
import threeOpenssh07 from "@/assets/openssh/three-openssh-07.png";

// 图片列表
const threeImgList = ref([
  threeOpenssh01,
  threeOpenssh02,
  threeOpenssh03,
  threeOpenssh04,
  threeOpenssh05,
  threeOpenssh06,
  threeOpenssh07,
]);
</script>
<style lang="scss">
.ssh-container .el-card__body {
  padding: 10px !important;
}
</style>
<style scoped lang="scss">
.ssh-container {
  display: block;
  overflow-y: auto;
  .ssh-header {
    display: flex;
    text-indent: 2em;
    text-align: left;
  }

  .ssh-header-title {
    font-weight: bold;
  }

  .ssh-content {
    width: 100%;
    flex-direction: row;
    .ssh-info-text {
      background-color: #eef0f4;
      padding: 8px;
      border-radius: 2px;
      word-wrap: break-word;
      word-break: break-all;
    }
    .ssh-info-img {
      border: 1px solid #dcdfe6;
      width: 100%;
      margin: 5px 0px;
    }
  }

  .ssh-link-download {
    text-decoration: none;
    color: #303133;
  }
  .ssh-link-download:hover {
    text-decoration: underline;
    cursor: pointer;
  }
}
</style>
