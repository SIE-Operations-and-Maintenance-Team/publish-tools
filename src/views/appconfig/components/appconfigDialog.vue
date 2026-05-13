<template>
  <div class="appconfig-container">
    <el-dialog v-model="state.dialog.show" :title="state.dialog.title" :close-on-click-modal="false"
      modal-class="appconfig-dialog" draggable width="680px">
      <el-form ref="appconfigDialogFormRef" size="default" label-width="100px" :model="state.ruleForm"
        :rules="formRules" :disabled="formDisabled">
        <el-row :gutter="10">
          <el-col :span="24">
            <el-form-item label="项目管理" prop="projectId">
              <el-select filterable placeholder="请选择项目管理" size="default" v-model="state.ruleForm.projectId"
                @change="onProjectChange">
                <el-option v-for="project in projectList" :key="project.id" :label="project.name" :value="project.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <div class="form-item-env">
              <el-radio-group size="default" @change="onEnvironmentChange" v-model="state.ruleForm.environment">
                <el-radio border :value="1">Dev</el-radio>
                <el-radio border :value="2">Uat</el-radio>
                <el-radio border :value="3">Pro</el-radio>
                <el-radio border :value="4">Other</el-radio>
              </el-radio-group>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="form-item-version">
              <el-checkbox v-model="state.ruleForm.configItems.isNewVersion" label="是否 10.2+ 版本"
                @change="onIsNewVersionChange" />
              <p class="version-remark">
                提示：SMOM 10.2
                版本之后，项目工程框架已升级至.NET6+，WpfClient发布方式和之前版本有所不同。
              </p>
            </div>
          </el-col>
          <el-col :span="24" class="mb15">
            <el-form-item label="获取模式" prop="buildMode">
              <el-select v-model="state.ruleForm.buildMode" placeholder="请选择获取模式" @change="onBuildModeChange">
                <el-option label="Debug" value="Debug" />
                <el-option label="Release" value="Release" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="9" class="mb15">
            <el-form-item label-width="100" label="获取dll方式" prop="dllMode">
              <el-select v-model="state.ruleForm.dllMode" placeholder="请选择dll获取方式" @change="onDllModeChange">
                <el-option label="全部" value="全部" />
                <el-option label="当天" value="当天" />
                <el-option label="最近3天" value="最近3天" />
                <el-option label="日期范围" value="日期范围" />
                <el-option label="DLL名称" value="DLL名称" />
                <el-option label="TFS" value="TFS" />
                <el-option label="Git" value="Git" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="15" class="mb15" v-show="state.ruleForm.dllMode === '日期范围'">
            <el-form-item label-width="0" prop="dllModeValue">
              <el-date-picker v-model="dllModeDate" type="datetimerange" range-separator="~" start-placeholder="起始日期"
                end-placeholder="截止日期" @change="onDllModeDateChange" />
            </el-form-item>
          </el-col>
          <el-col :span="15" class="mb15" v-show="state.ruleForm.dllMode === 'TFS'">
            <el-form-item label-width="0" prop="tfsId">
              <el-select filterable placeholder="请选择TFS" size="default" v-model="selectTfsItem.id"
                @change="onTfsChange">
                <el-option v-for="tfs in tfsList" :key="tfs.id" :label="tfs.tfsName" :value="tfs.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="15" class="mb15" v-show="state.ruleForm.dllMode === 'DLL名称'">
            <el-form-item label-width="0" prop="dllModeValue">
              <el-input v-model="state.ruleForm.dllModeValue" type="textarea" :rows="3" placeholder="请输入DLL名称，每行一个，支持*和?通配符，顿号分隔"
                maxlength="2000" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="15" class="mb15" v-show="state.ruleForm.dllMode === 'Git'">
            <el-form-item label-width="0" prop="gitId">
              <el-select filterable placeholder="请选择Git" size="default" v-model="selectGitItem.id"
                @change="onGitChange">
                <el-option v-for="git in gitList" :key="git.id" :label="git.gitName" :value="git.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <template v-if="state.ruleForm.dllMode === 'TFS' && selectTfsItem.id">
            <el-col :span="6" class="mb15" style="text-align: right">
              <el-radio-group v-model="selectTfsItem.selectModel" @change="onSelectTfsModelChange">
                <el-radio-button label="日期" value="日期" />
                <el-radio-button label="变更集" value="变更集" />
              </el-radio-group>
            </el-col>
            <el-col :span="8" class="mb10">
              <el-form-item label-width="0px">
                <el-date-picker class="w100" v-if="selectTfsItem.selectModel === '日期'"
                  v-model="selectTfsItem.selectValue[0].value" type="datetime"
                  :placeholder="selectTfsItem.selectValue[0].placeholder" />
                <el-input v-else v-model="selectTfsItem.selectValue[0].value"
                  :placeholder="selectTfsItem.selectValue[0].placeholder" maxlength="150" clearable></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="1" class="mb10">
              <div class="range-separator">~</div>
            </el-col>
            <el-col :span="9" class="mb10">
              <el-form-item label-width="0px">
                <el-date-picker class="w100" v-if="selectTfsItem.selectModel === '日期'"
                  v-model="selectTfsItem.selectValue[1].value" type="datetime"
                  :placeholder="selectTfsItem.selectValue[1].placeholder" />
                <el-input v-else v-model="selectTfsItem.selectValue[1].value"
                  :placeholder="selectTfsItem.selectValue[1].placeholder" maxlength="150" clearable></el-input>
              </el-form-item>
            </el-col>
          </template>
          <!-- Git 配置项 -->
          <template v-if="state.ruleForm.dllMode === 'Git' && selectGitItem.id">
            <el-col :span="6" class="mb15" style="text-align: right">
              <el-radio-group v-model="selectGitItem.selectModel" @change="onSelectGitModelChange">
                <el-radio-button label="日期" value="日期" />
                <el-radio-button label="变更集" value="变更集" />
              </el-radio-group>
            </el-col>
            <el-col :span="8" class="mb10">
              <el-form-item label-width="0px">
                <el-date-picker class="w100" v-if="selectGitItem.selectModel === '日期'"
                  v-model="selectGitItem.selectValue[0].value" type="datetime"
                  :placeholder="selectGitItem.selectValue[0].placeholder" />
                <el-input v-else v-model="selectGitItem.selectValue[0].value"
                  :placeholder="selectGitItem.selectValue[0].placeholder" maxlength="150" clearable></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="1" class="mb10">
              <div class="range-separator">~</div>
            </el-col>
            <el-col :span="9" class="mb10">
              <el-form-item label-width="0px">
                <el-date-picker class="w100" v-if="selectGitItem.selectModel === '日期'"
                  v-model="selectGitItem.selectValue[1].value" type="datetime"
                  :placeholder="selectGitItem.selectValue[1].placeholder" />
                <el-input v-else v-model="selectGitItem.selectValue[1].value"
                  :placeholder="selectGitItem.selectValue[1].placeholder" maxlength="150" clearable></el-input>
              </el-form-item>
            </el-col>
          </template>
          <el-tooltip content="选择 *.sln 解决方案文件 ==> 解析生成路径" placement="right" effect="light"
            v-if="formDisabled == false">
            <div class="form-select-file" @click="onSlnFileChange">
              <el-icon>
                <Files />
              </el-icon>
            </div>
          </el-tooltip>
        </el-row>
        <el-tabs type="border-card">
          <el-tab-pane label="WebApiHost">
            <el-row :gutter="10">
              <el-col :span="24" class="mb15">
                <el-form-item label-width="135" label="客户端生成路径" prop="configItems.webApiHost.clientPath" :rules="[
                  {
                    required: false,
                    message: '请输入客户端生成路径！',
                    trigger: ['blur'],
                  },
                ]">
                  <el-input v-model="state.ruleForm.configItems.webApiHost.clientPath" placeholder="请输入客户端生成路径"
                    maxlength="450" clearable></el-input>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label-width="135" label="应用服务器">
                  <el-select filterable v-model="state.ruleForm.configItems.webApiHost.serverIds" multiple
                    placeholder="请选择应用服务器" size="default" @change="onWebApiServerChange">
                    <el-option v-for="server in serverList" :key="server.id" :label="server.name" :value="server.id" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <fieldset class="form-server-fieldset" v-for="(webApiServer, apiIndex) in state.ruleForm.configItems.webApiHost
              .serverArr" :key="apiIndex">
              <legend class="form-server-legend">{{ webApiServer.name }}</legend>
              <el-row>
                <template v-for="(serverPath, index) in webApiServer.serverPathArr" :key="index">
                  <el-col :span="22" :class="webApiServer.serverPathArr.length - 1 === index ? '' : 'mb15'">
                    <el-form-item label-width="0" :label="serverPath.label">
                      <template v-for="(serverVal, valIndex) in serverPath.value" :key="valIndex">
                        <el-input v-model="serverVal.identity" placeholder="请输入服务标识" maxlength="200" clearable
                          class="mb5">
                          <template #prepend>服务标识</template>
                        </el-input>
                        <el-input v-model="serverVal.path" placeholder="请输入发布路径" maxlength="200" clearable>
                          <template #prepend>发布路径</template>
                        </el-input>
                      </template>
                    </el-form-item>
                  </el-col>
                  <el-col :span="2" v-if="formDisabled === false">
                    <div class="server-path-plus pt22">
                      <el-icon v-if="index === 0 && webApiServer.serverPathArr.length < 10" title="新增" color="#A8ABB2"
                        :size="26" @click="addServerPath(webApiServer)">
                        <CirclePlus />
                      </el-icon>
                      <el-icon v-else title="移除" color="#F56C6C" :size="26"
                        @click="removeServerPath(webApiServer, index)">
                        <Remove />
                      </el-icon>
                    </div>
                  </el-col>
                </template>
              </el-row>
            </fieldset>
          </el-tab-pane>
          <el-tab-pane label="ScheduleServer">
            <el-row :gutter="10">
              <el-col :span="24" class="mb15">
                <el-form-item label-width="135" label="客户端生成路径" prop="configItems.scheduleServer.clientPath" :rules="[
                  {
                    required: false,
                    message: '请输入客户端生成路径！',
                    trigger: ['blur'],
                  },
                ]">
                  <el-input v-model="state.ruleForm.configItems.scheduleServer.clientPath" placeholder="请输入客户端生成路径"
                    maxlength="450" clearable></el-input>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label-width="135" label="应用服务器">
                  <el-select filterable v-model="state.ruleForm.configItems.scheduleServer.serverIds" multiple
                    placeholder="请选择应用服务器" size="default" @change="onScheduleServerChange">
                    <el-option v-for="server in serverList" :key="server.id" :label="server.name" :value="server.id" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <fieldset class="form-server-fieldset" v-for="(scheduleServer, scheduleIndex) in state.ruleForm.configItems
              .scheduleServer.serverArr" :key="scheduleIndex">
              <legend class="form-server-legend">{{ scheduleServer.name }}</legend>
              <el-row>
                <template v-for="(serverPath, index) in scheduleServer.serverPathArr" :key="index">
                  <el-col :span="22" :class="scheduleServer.serverPathArr.length - 1 === index ? '' : 'mb15'">
                    <el-form-item label-width="0" :label="serverPath.label">
                      <template v-for="(serverVal, valIndex) in serverPath.value" :key="valIndex">
                        <el-input v-model="serverVal.identity" placeholder="请输入服务标识" maxlength="200" clearable
                          class="mb5">
                          <template #prepend>服务标识</template>
                        </el-input>
                        <el-input v-model="serverVal.path" placeholder="请输入发布路径" maxlength="200" clearable>
                          <template #prepend>发布路径</template>
                        </el-input>
                      </template>
                    </el-form-item>
                  </el-col>
                  <el-col :span="2" v-if="formDisabled === false">
                    <div class="server-path-plus pt22">
                      <el-icon v-if="index === 0 && scheduleServer.serverPathArr.length < 10" title="新增" color="#A8ABB2"
                        :size="26" @click="addServerPath(scheduleServer)">
                        <CirclePlus />
                      </el-icon>
                      <el-icon v-else title="移除" color="#F56C6C" :size="26"
                        @click="removeServerPath(scheduleServer, index)">
                        <Remove />
                      </el-icon>
                    </div>
                  </el-col>
                </template>
              </el-row>
            </fieldset>
          </el-tab-pane>
          <el-tab-pane label="WebClient">
            <el-row :gutter="10">
              <el-col :span="24" class="mb15">
                <el-form-item label-width="135" label="客户端生成路径" prop="configItems.webClient.clientPath" :rules="[
                  {
                    required: false,
                    message: '请输入客户端生成路径！',
                    trigger: ['blur'],
                  },
                ]">
                  <el-input v-model="state.ruleForm.configItems.webClient.clientPath" placeholder="请输入客户端生成路径"
                    maxlength="450" clearable></el-input>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label-width="135" label="应用服务器">
                  <el-select filterable v-model="state.ruleForm.configItems.webClient.serverIds" multiple
                    placeholder="请选择应用服务器" size="default" @change="onWebClientServerChange">
                    <el-option v-for="server in serverList" :key="server.id" :label="server.name" :value="server.id" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <fieldset class="form-server-fieldset" v-for="(webClientServer, clientIndex) in state.ruleForm.configItems
              .webClient.serverArr" :key="clientIndex">
              <legend class="form-server-legend">{{ webClientServer.name }}</legend>
              <el-row>
                <template v-for="(serverPath, index) in webClientServer.serverPathArr" :key="index">
                  <el-col :span="22" :class="webClientServer.serverPathArr.length - 1 === index ? '' : 'mb15'
                    ">
                    <el-form-item label-width="0" :label="serverPath.label">
                      <template v-for="(serverVal, valIndex) in serverPath.value" :key="valIndex">
                        <el-input v-model="serverVal.identity" placeholder="请输入服务标识" maxlength="200" clearable
                          class="mb5">
                          <template #prepend>服务标识</template>
                        </el-input>
                        <el-input v-model="serverVal.path" placeholder="请输入发布路径" maxlength="200" clearable>
                          <template #prepend>发布路径</template>
                        </el-input>
                      </template>
                    </el-form-item>
                  </el-col>
                  <el-col :span="2" v-if="formDisabled === false">
                    <div class="server-path-plus pt22">
                      <el-icon v-if="index === 0 && webClientServer.serverPathArr.length < 10" title="新增"
                        color="#A8ABB2" :size="26" @click="addServerPath(webClientServer)">
                        <CirclePlus />
                      </el-icon>
                      <el-icon v-else title="移除" color="#F56C6C" :size="26"
                        @click="removeServerPath(webClientServer, index)">
                        <Remove />
                      </el-icon>
                    </div>
                  </el-col>
                </template>
              </el-row>
            </fieldset>
          </el-tab-pane>
          <el-tab-pane label="WpfClient">
            <el-row :gutter="10">
              <el-col :span="24" class="mb15">
                <el-form-item label-width="135" label="客户端生成路径" prop="configItems.wpfClient.clientPath" :rules="[
                  {
                    required: false,
                    message: '请输入客户端生成路径！',
                    trigger: ['blur'],
                  },
                ]">
                  <el-input v-model="state.ruleForm.configItems.wpfClient.clientPath" placeholder="请输入客户端生成路径"
                    maxlength="450" clearable></el-input>
                </el-form-item>
              </el-col>
              <el-col :span="24" class="mb15">
                <el-form-item label-width="135" label="选择生成目录" prop="configItems.wpfClient.generateDirJson" :rules="[
                  {
                    required: false,
                    message: '请选择生成目录！',
                    trigger: ['blur', 'change'],
                  },
                ]">
                  <el-select v-model="generateDirs" multiple placeholder="选择生成的目录" @change="onGenerateDirChange">
                    <el-option :disabled="true" label="AddIns" value="AddIns" />
                    <template v-if="state.ruleForm.configItems.isNewVersion">
                      <el-option label="Plugins" value="Plugins" />
                    </template>
                    <template v-else>
                      <el-option label="Domain" value="Domain" />
                      <el-option label="UI" value="UI" />
                    </template>
                    <el-option label="Lib" value="Lib" />
                    <el-option :disabled="true" label="Templates" value="Templates" />
                    <el-option :disabled="true" label="Localization" value="Localization" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="24" class="mb15">
                <el-form-item label-width="135" label="是否打包(压缩)" prop="isCompress">
                  <el-tooltip effect="dark" content="[获取dll方式]为[全部]时，才允许打包(压缩)文件" placement="right-start">
                    <el-switch v-model="state.ruleForm.configItems.wpfClient.isCompress" :active-value="1"
                      :inactive-value="0" :disabled="state.ruleForm.dllMode !== '全部'" inline-prompt active-text="是"
                      inactive-text="否" size="default" @change="onCompressChange" />
                  </el-tooltip>
                </el-form-item>
              </el-col>
              <el-col :span="24" class="mb15" v-show="state.ruleForm.configItems.wpfClient.isCompress">
                <el-form-item label-width="135" label="选择打包(压缩)文件" prop="configItems.wpfClient.compressFileJson" :rules="[
                  {
                    validator: validCompressFile,
                    trigger: ['blur', 'change'],
                  },
                ]">
                  <el-select v-model="compressFiles" multiple placeholder="请选择压缩的文件" @change="onCompressFileChange">
                    <el-option label="AddIns.zip" value="AddIns.zip" />
                    <el-option label="Config.zip" value="Config.zip" />
                    <el-option label="Lib.zip" value="Lib.zip" />
                    <el-option label="Localization.zip" value="Localization.zip" />
                    <el-option label="Main.zip" value="Main.zip" />
                    <el-option label="Plugins.zip" value="Plugins.zip" />
                    <el-option label="Templates.zip" value="Templates.zip" />
                    <el-option label="runtimes.zip" value="runtimes.zip" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="24" class="mb15">
                <el-form-item label-width="135" label="应用服务器">
                  <el-select filterable v-model="state.ruleForm.configItems.wpfClient.serverId" placeholder="请选择应用服务器"
                    size="default" @change="onWpfClientServerChange">
                    <el-option v-for="server in serverList" :key="server.id" :label="server.name" :value="server.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label-width="135" label="服务发布路径">
                  <el-input v-model="state.ruleForm.configItems.wpfClient.serverPath" placeholder="请输入服务发布路径"
                    maxlength="450" clearable></el-input>
                </el-form-item>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="SpcMonitor">
            <el-row :gutter="10">
              <el-col :span="24" class="mb15">
                <el-form-item label-width="135" label="客户端生成路径">
                  <el-input v-model="state.ruleForm.configItems.spcMonitor.clientPath" placeholder="请输入客户端生成路径"
                    maxlength="450" clearable></el-input>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label-width="135" label="应用服务器">
                  <el-select filterable v-model="state.ruleForm.configItems.spcMonitor.serverIds" multiple
                    placeholder="请选择应用服务器" size="default" @change="onSpcMonitorServerChange">
                    <el-option v-for="server in serverList" :key="server.id" :label="server.name" :value="server.id" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <fieldset class="form-server-fieldset" v-for="(spcMonitor, spcIndex) in state.ruleForm.configItems.spcMonitor
              .serverArr" :key="spcIndex">
              <legend class="form-server-legend">{{ spcMonitor.name }}</legend>
              <el-row>
                <template v-for="(serverPath, index) in spcMonitor.serverPathArr" :key="index">
                  <el-col :span="22" :class="spcMonitor.serverPathArr.length - 1 === index ? '' : 'mb15'">
                    <el-form-item label-width="0" :label="serverPath.label">
                      <template v-for="(serverVal, valIndex) in serverPath.value" :key="valIndex">
                        <el-input v-model="serverVal.identity" placeholder="请输入服务标识" maxlength="200" clearable
                          class="mb5">
                          <template #prepend>服务标识</template>
                        </el-input>
                        <el-input v-model="serverVal.path" placeholder="请输入发布路径" maxlength="200" clearable>
                          <template #prepend>发布路径</template>
                        </el-input>
                      </template>
                    </el-form-item>
                  </el-col>
                  <el-col :span="2" v-if="formDisabled === false">
                    <div class="server-path-plus pt22">
                      <el-icon v-if="index === 0 && spcMonitor.serverPathArr.length < 10" title="新增" color="#A8ABB2"
                        :size="26" @click="addServerPath(spcMonitor)">
                        <CirclePlus />
                      </el-icon>
                      <el-icon v-else title="移除" color="#F56C6C" :size="26"
                        @click="removeServerPath(spcMonitor, index)">
                        <Remove />
                      </el-icon>
                    </div>
                  </el-col>
                </template>
              </el-row>
            </fieldset>
          </el-tab-pane>
        </el-tabs>
        <el-row :gutter="10">
          <el-col :span="24" class="mt15">
            <el-tooltip
              content="如：Visual Studio 2022 的 MsBuild.exe 编译路径为：{盘符}:\Program Files\Microsoft Visual Studio\2022\{Edition}\MSBuild\Current\Bin\MSBuild.exe"
              placement="top" effect="light">
              <el-form-item label="MsBuild路径" prop="msBuildPath">
                <el-input v-model="state.ruleForm.msBuildPath" placeholder="请输入MsBuild路径" maxlength="450"
                  clearable></el-input>
              </el-form-item>
            </el-tooltip>
          </el-col>
          <el-col :span="6" class="mt15">
            <el-form-item label="重新编译" prop="isRebuild">
              <el-tooltip content="【/t:Rebuild】建议勾选！" placement="bottom" effect="light">
                <el-switch v-model="state.ruleForm.configItems.isRebuild" :active-value="1" :inactive-value="0"
                  inline-prompt active-text="是" inactive-text="否" size="default" />
              </el-tooltip>
            </el-form-item>
          </el-col>
          <el-col :span="6" class="mt15">
            <el-form-item label="发布前备份" prop="isBackup">
              <el-switch v-model="state.ruleForm.configItems.isBackup" :active-value="1" :inactive-value="0"
                inline-prompt active-text="开启" inactive-text="关闭" size="default" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default">取 消</el-button>
          <el-button type="primary" size="default" v-if="!formDisabled"
            @click="submitValidate(appconfigDialogFormRef)">{{ state.dialog.submitTxt }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="appconfigDialog">
import { nextTick, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { CirclePlus, Remove, Files } from "@element-plus/icons-vue";
import { open } from "@tauri-apps/plugin-dialog";
import _ from "lodash";
import { cmdInvoke } from "@/utils/command";
import { useAppconfigDb } from "@/database/appconfig/index";
import { useProjectDb } from "@/database/project/index";
import { useServerDb } from "@/database/servers/index";
import { useTfsDb } from "@/database/teamFoundationServer/index";
import { useGitDb } from "@/database/git/index";
import { formatDate } from "@/utils/formatTime";
import { getDefaultSubObject, removeSlash } from "@/utils/other";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh"]);

// 引入应用配置管理数据库
const appconfigDb = useAppconfigDb();
const projectDb = useProjectDb();
const serverDb = useServerDb();
const tfsDb = useTfsDb();
const gitDb = useGitDb();

// 定义变量内容
const appconfigDialogFormRef = ref();
const projectList = ref<RowProjectType[]>();
const serverList = ref<RowServerType[]>();
const tfsList = ref<RowTfsType[]>();
const gitList = ref<RowGitType[]>();
const formDisabled = ref(false);
const generateDirs = ref<string[]>([]);
const compressFiles = ref([]);
const dllModeDate = ref<[Date, Date]>();
const selectTfsItem = ref<SelectTfsType>({
  id: null,
  tfsName: null,
  selectModel: "日期",
  selectValue: [
    {
      placeholder: "日期开始(必填)",
      value: "",
    },
    {
      placeholder: "日期结束(选填，空为最新)",
      value: "",
    },
  ],
});
const selectGitItem = ref<SelectGitType>({
  id: null,
  gitName: null,
  selectModel: "日期",
  selectValue: [
    {
      placeholder: "日期开始(必填)",
      value: "",
    },
    {
      placeholder: "日期结束(选填，空为最新)",
      value: "",
    },
  ],
});
const state = reactive<FormDialogType<RowAppconfigType>>({
  ruleForm: {
    id: null,
    projectId: null,
    projectName: null,
    environment: 1,
    msBuildPath: null,
    dllMode: "全部",
    dllModeValue: null,
    buildMode: "Debug",
    configItemsJson: "",
    configItems: {
      webApiHost: {
        clientPath: "",
        serverPath: "",
        serverIds: [],
        serverArr: [],
      },
      webClient: {
        clientPath: "",
        serverPath: "",
        serverIds: [],
        serverArr: [],
      },
      wpfClient: {
        clientPath: "",
        serverId: null,
        serverName: null,
        serverPath: "",
        isCompress: 1,
        generateDirJson: "",
        compressFileJson: "",
      },
      scheduleServer: {
        clientPath: "",
        serverPath: "",
        serverIds: [],
        serverArr: [],
      },
      spcMonitor: {
        clientPath: "",
        serverPath: "",
        serverIds: [],
        serverArr: [],
      },
      isRebuild: 1,
      isBackup: 0,
      isNewVersion: false,
    },
  },
  dialog: {
    show: false,
    type: "add",
    editId: null,
    title: "提示",
    submitTxt: "确定",
  },
});

// 选择*.sln解决方案文件
const onSlnFileChange = async () => {
  const selectSlnFileResult = await open({
    multiple: false,
    filters: [
      {
        name: "解决方案文件",
        extensions: ["sln"],
      },
    ],
  });
  if (!selectSlnFileResult) {
    console.warn("未选择*.sln解决方案文件");
    return;
  }
  // 得到项目路径
  const slnFilePath = removeSlash(String(selectSlnFileResult));
  // 解析解决方案文件
  const modules = [
    "SIE.WebApiHost.csproj",
    "SIE.ScheduleServer.csproj",
    "WebClient.csproj",
    "WpfClient.csproj",
    "SIE.SpcMonitor.csproj",
  ];
  for (let i = 0; i < modules.length; i++) {
    const moduleName = modules[i];
    const parseSlnProjectResult = await cmdInvoke("parse_sln_project", {
      moduleName,
      slnFilePath: slnFilePath,
      isNewVersion: state.ruleForm.configItems.isNewVersion,
      buildMode: state.ruleForm.buildMode || "Debug",
    });
    if (parseSlnProjectResult.code !== 0) {
      console.warn(parseSlnProjectResult.data);
      continue;
    }
    switch (moduleName) {
      case "SIE.WebApiHost.csproj":
        state.ruleForm.configItems.webApiHost.clientPath = parseSlnProjectResult.data;
        break;
      case "SIE.ScheduleServer.csproj":
        state.ruleForm.configItems.scheduleServer.clientPath = parseSlnProjectResult.data;
        break;
      case "WebClient.csproj":
        state.ruleForm.configItems.webClient.clientPath = parseSlnProjectResult.data;
        break;
      case "WpfClient.csproj":
        state.ruleForm.configItems.wpfClient.clientPath = parseSlnProjectResult.data;
        break;
      case "SIE.SpcMonitor.csproj":
        state.ruleForm.configItems.spcMonitor.clientPath = parseSlnProjectResult.data;
        break;
      default:
        break;
    }
  }

  // 默认选中：Domain、UI
  if (!generateDirs.value || generateDirs.value.length === 0) {
    generateDirs.value = state.ruleForm.configItems.isNewVersion
      ? ["Plugins"]
      : ["Domain", "UI"];
    state.ruleForm.configItems.wpfClient.generateDirJson = JSON.stringify(
      generateDirs.value
    );
  }
  return true;
};

// 项目管理切换监听
const onProjectChange = async (val: number) => {
  getServerList(val);
  state.ruleForm.configItems.webApiHost.serverIds = [];
  state.ruleForm.configItems.webApiHost.serverArr = [];
  state.ruleForm.configItems.webClient.serverIds = [];
  state.ruleForm.configItems.webClient.serverArr = [];
  state.ruleForm.configItems.spcMonitor.serverIds = [];
  state.ruleForm.configItems.spcMonitor.serverArr = [];
};

// 是否 10.2+ 版本切换
const onIsNewVersionChange = async (val: boolean) => {
  if (generateDirs.value && generateDirs.value.length > 0 && val) {
    const domainIndex = generateDirs.value.indexOf("Domain");
    if (domainIndex !== -1) {
      generateDirs.value.splice(domainIndex, 1);
    }
    const uiIndex = generateDirs.value.indexOf("UI");
    if (uiIndex !== -1) {
      generateDirs.value.splice(uiIndex, 1);
    }
  } else if (generateDirs.value && generateDirs.value.length > 0 && !val) {
    const pIndex = generateDirs.value.indexOf("Plugins");
    if (pIndex !== -1) {
      generateDirs.value.splice(pIndex, 1);
    }
  }

  // 默认选中
  if (!generateDirs.value || generateDirs.value.length === 0) {
    generateDirs.value = state.ruleForm.configItems.isNewVersion
      ? ["Plugins"]
      : ["Domain", "UI"];
    state.ruleForm.configItems.wpfClient.generateDirJson = JSON.stringify(
      generateDirs.value
    );
  }
};

// 获取dll方式切换
const onDllModeChange = async (val: string) => {
  if (val !== "全部" && state.ruleForm.configItems.wpfClient.isCompress == 1) {
    state.ruleForm.configItems.wpfClient.isCompress = 0;
  }
  state.ruleForm.dllModeValue = null;
  dllModeDate.value = [Object(null), Object(null)];

  // TFS
  selectTfsItem.value.id = null;
  selectTfsItem.value.tfsName = null;
  selectTfsItem.value.selectModel = "日期";
  selectTfsItem.value.selectValue = [
    {
      placeholder: "日期开始(必填)",
      value: "",
    },
    {
      placeholder: "日期结束(选填，空为最新)",
      value: "",
    },
  ];
};

// 环境切换
const onEnvironmentChange = async (val: number) => {
  console.log("环境切换为：", val);
};

// 获取模式切换
const onBuildModeChange = async (val: string) => {
  if (!val || (val !== "Debug" && val !== "Release")) return;
  
  // 替换所有客户端生成路径中的 Debug/Release
  const oldMode = val === "Debug" ? "Release" : "Debug";
  
  // WebApiHost
  if (state.ruleForm.configItems.webApiHost.clientPath) {
    state.ruleForm.configItems.webApiHost.clientPath = state.ruleForm.configItems.webApiHost.clientPath.replace(
      new RegExp(`/bin/${oldMode}(/|$)`, 'g'),
      `/bin/${val}$1`
    );
  }
  
  // ScheduleServer
  if (state.ruleForm.configItems.scheduleServer.clientPath) {
    state.ruleForm.configItems.scheduleServer.clientPath = state.ruleForm.configItems.scheduleServer.clientPath.replace(
      new RegExp(`/bin/${oldMode}(/|$)`, 'g'),
      `/bin/${val}$1`
    );
  }
  
  // WebClient
  if (state.ruleForm.configItems.webClient.clientPath) {
    state.ruleForm.configItems.webClient.clientPath = state.ruleForm.configItems.webClient.clientPath.replace(
      new RegExp(`/bin/${oldMode}(/|$)`, 'g'),
      `/bin/${val}$1`
    );
  }
  
  // WpfClient
  if (state.ruleForm.configItems.wpfClient.clientPath) {
    state.ruleForm.configItems.wpfClient.clientPath = state.ruleForm.configItems.wpfClient.clientPath.replace(
      new RegExp(`/bin/${oldMode}(/|$)`, 'g'),
      `/bin/${val}$1`
    );
  }
  
  // SpcMonitor
  if (state.ruleForm.configItems.spcMonitor.clientPath) {
    state.ruleForm.configItems.spcMonitor.clientPath = state.ruleForm.configItems.spcMonitor.clientPath.replace(
      new RegExp(`/bin/${oldMode}(/|$)`, 'g'),
      `/bin/${val}$1`
    );
  }
};

// 调度服务器切换
const onScheduleServerChange = async (val: number[]) => {
  if (!val || val.length < 1) {
    state.ruleForm.configItems.scheduleServer.serverArr = [];
    return;
  }
  // 移除
  for (let i = 0; i < state.ruleForm.configItems.scheduleServer.serverArr.length; i++) {
    const scheduleServer = state.ruleForm.configItems.scheduleServer.serverArr[i];
    if (val.includes(Number(scheduleServer.id))) continue;
    state.ruleForm.configItems.scheduleServer.serverArr.splice(i, 1);
  }
  // 新增
  for (let i = 0; i < val.length; i++) {
    const scheduleServer = state.ruleForm.configItems.scheduleServer.serverArr.find(
      (item: SelectServerType) => item.id === val[i]
    );
    if (scheduleServer) continue;
    const sServer = serverList.value?.find(
      (item: RowServerType) => item.id === val[i]
    );
    if (!sServer) continue;
    state.ruleForm.configItems.scheduleServer.serverArr.push({
      id: sServer.id,
      name: sServer.name,
      serverPathArr: [
        {
          label: "", // 服务端发布
          value: [
            {
              identity: "",
              path: "",
            },
          ],
        },
      ],
    });
  }
};

// wpf服务器切换
const onWpfClientServerChange = async (val: number) => {
  if (!val || val < 1) {
    state.ruleForm.configItems.wpfClient.serverName = "";
    return;
  }
  let server = serverList.value?.find((x) => x.id === val);
  if (server) {
    state.ruleForm.configItems.wpfClient.serverName = server.name;
  }
};

// 选择[WebApi]服务器切换
const onWebApiServerChange = async (val: number[]) => {
  if (!val || val.length < 1) {
    state.ruleForm.configItems.webApiHost.serverArr = [];
    return;
  }
  // 移除
  for (let i = 0; i < state.ruleForm.configItems.webApiHost.serverArr.length; i++) {
    const webApiServer = state.ruleForm.configItems.webApiHost.serverArr[i];
    if (val.includes(Number(webApiServer.id))) continue;
    state.ruleForm.configItems.webApiHost.serverArr.splice(i, 1);
  }
  // 新增
  for (let i = 0; i < val.length; i++) {
    const webApiServer = state.ruleForm.configItems.webApiHost.serverArr.find(
      (item: SelectServerType) => item.id === val[i]
    );
    if (webApiServer) continue;
    const wApiServer = serverList.value?.find(
      (item: RowServerType) => item.id === val[i]
    );
    if (!wApiServer) continue;
    state.ruleForm.configItems.webApiHost.serverArr.push({
      id: wApiServer.id,
      name: wApiServer.name,
      serverPathArr: [
        {
          label: "", // 服务端发布
          value: [
            {
              identity: "",
              path: "",
            },
          ],
        },
      ],
    });
  }
};

// 选择[SpcMonitor]服务器切换
const onSpcMonitorServerChange = async (val: number[]) => {
  if (!val || val.length < 1) {
    state.ruleForm.configItems.spcMonitor.serverArr = [];
    return;
  }

  // 移除
  for (let i = 0; i < state.ruleForm.configItems.spcMonitor.serverArr.length; i++) {
    const spcMonitorServer = state.ruleForm.configItems.spcMonitor.serverArr[i];
    if (val.includes(Number(spcMonitorServer.id))) continue;
    state.ruleForm.configItems.spcMonitor.serverArr.splice(i, 1);
  }

  // 新增
  for (let i = 0; i < val.length; i++) {
    const spcMonitorServer = state.ruleForm.configItems.spcMonitor.serverArr.find(
      (item: SelectServerType) => item.id === val[i]
    );
    if (spcMonitorServer) continue;
    const sMonitorServer = serverList.value?.find(
      (item: RowServerType) => item.id === val[i]
    );
    if (!sMonitorServer) continue;
    state.ruleForm.configItems.spcMonitor.serverArr.push({
      id: sMonitorServer.id,
      name: sMonitorServer.name,
      serverPathArr: [
        {
          label: "", // 服务端发布
          value: [
            {
              identity: "",
              path: "",
            },
          ],
        },
      ],
    });
  }
};

// 选择[WebClient]服务器切换
const onWebClientServerChange = async (val: number[]) => {
  if (!val || val.length < 1) {
    state.ruleForm.configItems.webClient.serverArr = [];
    return;
  }

  // 移除
  for (let i = 0; i < state.ruleForm.configItems.webClient.serverArr.length; i++) {
    const webClientServer = state.ruleForm.configItems.webClient.serverArr[i];
    if (val.includes(Number(webClientServer.id))) continue;
    state.ruleForm.configItems.webClient.serverArr.splice(i, 1);
  }

  // 新增
  for (let i = 0; i < val.length; i++) {
    const webClientServer = state.ruleForm.configItems.webClient.serverArr.find(
      (item: SelectServerType) => item.id === val[i]
    );
    if (webClientServer) continue;
    const wClientServer = serverList.value?.find(
      (item: RowServerType) => item.id === val[i]
    );
    if (!wClientServer) continue;
    state.ruleForm.configItems.webClient.serverArr.push({
      id: wClientServer.id,
      name: wClientServer.name,
      serverPathArr: [
        {
          label: "", // 服务端发布
          value: [
            {
              identity: "",
              path: "",
            },
          ],
        },
      ],
    });
  }
};

// 新增服务路径
const addServerPath = async (serverConfig: SelectServerType) => {
  serverConfig.serverPathArr.push({
    label: "",
    value: [
      {
        identity: "",
        path: "",
      },
    ],
  });
};

// 删除服务路径
const removeServerPath = async (serverConfig: SelectServerType, index: number) => {
  serverConfig.serverPathArr.splice(index, 1);
};

// 是否打包(压缩)切换
const onCompressChange = async (val: number) => {
  // 还原
  compressFiles.value = [];
  state.ruleForm.configItems.wpfClient.compressFileJson = "";
  console.log("是否打包(压缩)切换为：", val);
};

// 生成目录切换
const onGenerateDirChange = async (val: string[]) => {
  if (!val || val.length === 0) {
    state.ruleForm.configItems.wpfClient.generateDirJson = "";
    return;
  }
  state.ruleForm.configItems.wpfClient.generateDirJson = JSON.stringify(val);
};

// 压缩文件切换
const onCompressFileChange = async (val: string[]) => {
  if (!val || val.length === 0) {
    state.ruleForm.configItems.wpfClient.compressFileJson = "";
    return;
  }
  state.ruleForm.configItems.wpfClient.compressFileJson = JSON.stringify(val);
};

// 选择日期范围切换
const onDllModeDateChange = async (val: Date[]) => {
  if (!val || val.length === 0) {
    state.ruleForm.dllModeValue = "";
    return;
  }
  let startDate = formatDate(val[0], "YYYY-mm-dd HH:MM:SS");
  let endDate = formatDate(val[1], "YYYY-mm-dd HH:MM:SS");
  state.ruleForm.dllModeValue = JSON.stringify([startDate, endDate]);
};

// 选择TFS切换
const onTfsChange = async (val: number) => {
  if (!tfsList.value) return;
  const tfsItem = tfsList.value.find((x) => x.id == val);
  if (tfsItem) {
    selectTfsItem.value.id = tfsItem.id;
    selectTfsItem.value.tfsName = tfsItem.tfsName;
  }
};

// 选择Git切换
const onGitChange = async (val: number) => {
  if (!gitList.value) return;
  const gitItem = gitList.value.find((x) => x.id == val);
  if (gitItem) {
    selectGitItem.value.id = gitItem.id;
    selectGitItem.value.gitName = gitItem.gitName;
  }
};

// TFS模式切换
const onSelectTfsModelChange = (val: "日期" | "变更集") => {
  selectTfsItem.value.selectModel = val;
  if (val === "日期") {
    selectTfsItem.value.selectValue = [
      {
        placeholder: "日期开始(必填)",
        value: "",
      },
      {
        placeholder: "日期结束(选填，空为最新)",
        value: "",
      },
    ];
  } else {
    selectTfsItem.value.selectValue = [
      {
        placeholder: "变更集开始(必填)",
        value: "",
      },
      {
        placeholder: "变更集结束(选填，空为最新)",
        value: "",
      },
    ];
  }
};

const onSelectGitModelChange = (val: "日期" | "commit") => {
  selectGitItem.value.selectModel = val;
  if (val === "日期") {
    selectGitItem.value.selectValue = [
      {
        placeholder: "日期开始(必填)",
        value: "",
      },
      {
        placeholder: "日期结束(选填，空为最新)",
        value: "",
      },
    ];
  } else {
    selectGitItem.value.selectValue = [
      {
        placeholder: "commit开始(必填)",
        value: "",
      },
      {
        placeholder: "commit结束(选填，空为最新)",
        value: "",
      },
    ];
  }
};

// 表单验证规则
const formRules = reactive<FormRules>({
  projectId: [{ required: true, message: "请选择项目管理！", trigger: "change" }],
  dllMode: [{ required: true, message: "请选择获取dll方式！", trigger: "change" }],
  dllModeValue: [
    {
      validator: (rule: any, _value: any, callback: any) => {
        const dllModeValue = state.ruleForm.dllModeValue;
        if (!dllModeValue && state.ruleForm.dllMode === "日期范围") {
          callback(new Error("请选择日期范围！"));
        } else if (!dllModeValue && state.ruleForm.dllMode === "DLL名称") {
          callback(new Error("请输入DLL名称！"));
        } else {
          callback();
        }
        console.log(rule);
      },
      trigger: ["blur", "change"],
    },
  ],
});

// 验证压缩文件
const validCompressFile = (rule: any, value: any, callback: any) => {
  if (state.ruleForm.configItems.wpfClient.isCompress == 1) {
    if (!value || value.length === 0) {
      callback(new Error("请选择要压缩的文件！"));
    } else {
      callback();
    }
    console.log(rule);
  } else {
    callback();
  }
};

// 提交验证
const submitValidate = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    if (valid) {
      onSubmit();
    } else {
      ElMessage.warning("未验证通过，请检查！");
      console.warn("未验证通过!", fields);
    }
  });
};

// 表单重置
const formReset = () => {
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.ruleForm.configItems.wpfClient.isCompress = null;
  state.ruleForm.dllMode = "全部";
  state.ruleForm.buildMode = "Debug";
  if (state.ruleForm.projectId == 0) state.ruleForm.projectId = null;
  if (state.ruleForm.environment == 0) state.ruleForm.environment = 1;
  state.dialog.editId = null;
  state.dialog.type = "add";
  generateDirs.value = [];
  state.ruleForm.configItems.wpfClient.generateDirJson = "";
  state.ruleForm.configItems.webApiHost.serverIds = [];
  state.ruleForm.configItems.webApiHost.serverArr = [];
  state.ruleForm.configItems.webClient.serverIds = [];
  state.ruleForm.configItems.webClient.serverArr = [];
  state.ruleForm.configItems.scheduleServer.serverIds = [];
  state.ruleForm.configItems.scheduleServer.serverArr = [];
  state.ruleForm.configItems.wpfClient.serverId = null;
  state.ruleForm.configItems.spcMonitor.serverIds = [];
  state.ruleForm.configItems.spcMonitor.serverArr = [];
  state.ruleForm.configItems.isRebuild = 1;
  selectTfsItem.value = {
    id: null,
    tfsName: null,
    selectModel: "日期",
    selectValue: [
      {
        placeholder: "开始日期(必填)",
        value: "",
      },
      {
        placeholder: "结束日期(选填，空则表示为最新日期)",
        value: "",
      },
    ],
  };
};

// 打开弹窗
const openDialog = async (type: string, row: RowAppconfigType | undefined) => {
  /* Start: 重置表单内容 */
  formDisabled.value = type === "viewer";
  formReset();
  /* End: 重置表单内容 */
  await getProjectList();
  await getTfsList();
  await getGitList();
  nextTick(async () => {
    if (type === "edit" || type === "viewer") {
      state.dialog.type = "edit";
      state.dialog.editId = row?.id;
      Object.assign(state.ruleForm, row);
      if (state.ruleForm.configItems.wpfClient.generateDirJson) {
        generateDirs.value = JSON.parse(
          state.ruleForm.configItems.wpfClient.generateDirJson
        );
      }
      if (state.ruleForm.configItems.wpfClient.compressFileJson) {
        compressFiles.value = JSON.parse(
          state.ruleForm.configItems.wpfClient.compressFileJson
        );
      }

      if (state.ruleForm.dllModeValue && state.ruleForm.dllMode == "日期范围") {
        let dateJson = JSON.parse(state.ruleForm.dllModeValue);
        let beginDate = new Date(dateJson[0]);
        let endDate = new Date(dateJson[1]);
        dllModeDate.value = [beginDate, endDate];
      }

      if (state.ruleForm.dllModeValue && state.ruleForm.dllMode == "TFS") {
        selectTfsItem.value = JSON.parse(state.ruleForm.dllModeValue);
      }
      
      if (state.ruleForm.dllModeValue && state.ruleForm.dllMode == "Git") {
        selectGitItem.value = JSON.parse(state.ruleForm.dllModeValue);
      }

      appconfigDialogFormRef.value?.clearValidate();

      state.dialog.title = `${formDisabled.value ? "查看" : "修改"}应用配置`;
      state.dialog.submitTxt = "修 改";
    } else {
      state.dialog.title = "新增应用配置";
      state.dialog.submitTxt = "新 增";
    }
    await getServerList(state.ruleForm.projectId);
    state.dialog.show = true;
  });
};

// 关闭弹窗
const closeDialog = () => {
  state.dialog.show = false;
};

// 取消
const onCancel = () => {
  closeDialog();
};

// 提交
const onSubmit = async () => {
  state.ruleForm.configItemsJson = JSON.stringify(state.ruleForm.configItems);
  if (state.ruleForm.dllMode == "TFS") {
    const selectedItem = _.cloneDeep(selectTfsItem.value) as SelectTfsType;
    for (let i = 0; i < selectedItem.selectValue.length; i++) {
      const selItem = selectedItem.selectValue[i];
      if (selectedItem.selectModel == "日期") {
        let valDate = selItem.value as any;
        if (!valDate) continue;
        if (typeof valDate === "string") {
          valDate = new Date(valDate);
        }
        selItem.value = formatDate(valDate, "YYYY-mm-dd HH:MM:SS");
      }
    }
    state.ruleForm.dllModeValue = JSON.stringify(selectedItem);
  }
  if (state.ruleForm.dllMode == "Git") {
    const selectedItem = _.cloneDeep(selectGitItem.value) as SelectGitType;
    for (let i = 0; i < selectedItem.selectValue.length; i++) {
      const selItem = selectedItem.selectValue[i];
      if (selectedItem.selectModel == "日期") {
        let valDate = selItem.value as any;
        if (!valDate) continue;
        if (typeof valDate === "string") {
          valDate = new Date(valDate);
        }
        selItem.value = formatDate(valDate, "YYYY-mm-dd HH:MM:SS");
      }
    }
    state.ruleForm.dllModeValue = JSON.stringify(selectedItem);
  }
  if (state.dialog.type == "edit") {
    // 修改
    let updateResult = await appconfigDb.updateAppconfig(state.ruleForm);
    if (updateResult.code === 0) {
      ElMessage.success("修改成功！");
      closeDialog(); // 关闭弹窗
      emit("refresh");
    } else {
      ElMessage.error(updateResult.msg);
    }
    return;
  }

  // 添加
  let insertResult = await appconfigDb.insertAppconfig(state.ruleForm);
  if (insertResult.code === 0) {
    ElMessage.success("添加成功！");
    closeDialog(); // 关闭弹窗
    emit("refresh");
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 查询项目信息
const getProjectList = async () => {
  let dataResult = await projectDb.getProjectList({
    code: null,
    name: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  projectList.value = dataResult.data.data;
};

// 查询TFS信息
const getTfsList = async () => {
  let dataResult = await tfsDb.getTfsList({
    tfsName: null,
    tfsSourcePath: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  tfsList.value = dataResult.data.data;
};

const getGitList = async () => {
  let dataResult = await gitDb.getGitList({
    gitName: null,
    gitRepository: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  gitList.value = dataResult.data.data;
};

// 查询服务器信息
const getServerList = async (projectId: number | null) => {
  if (!projectId) return;
  let dataResult = await serverDb.getServerList({
    projectId: projectId,
    name: null,
    sorting: "ts.id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  serverList.value = dataResult.data.data;
};

// 暴露变量
defineExpose({
  openDialog,
});
</script>
<style lang="scss">
.el-overlay .el-overlay-dialog .el-dialog .el-dialog__body {
  padding: 0px !important;
}
</style>
<style lang="scss" scoped>
.form-item-env {
  width: 100%;
  margin: 15px 0px;
  text-align: center;
  background-color: #fbfbfb;
  padding: 10px;
}

.form-item-version {
  width: 100%;
  margin-bottom: 10px;
  text-align: left;
  background-color: #fdf6ec;
  padding: 10px;

  .version-remark {
    font-size: 12px;
  }
}

.server-path-plus {
  text-align: center;
  cursor: pointer;
  align-content: center;
  height: 32px;
  padding-top: 4px;
}

.form-server-fieldset {
  width: 100%;
  border: 1px #dcdfe6 solid;
  padding-top: 8px;
  padding-left: 10px;
  padding-bottom: 15px;
  margin-top: 10px;
}

.form-server-legend {
  padding: 0px 5px;
  margin-left: 15px;
}

.form-select-file {
  text-align: center;
  display: block;
  width: 100%;
  margin: 0px 5px;
  background-color: #fbfbfb;
  height: 32px;
  line-height: 37px;
  cursor: pointer;
}

.range-separator {
  text-align: center;
  height: 32px;
  line-height: 32px;
}
</style>
