<template>
  <div class="step-appconfig">
      <div class="step-appconfig-toolbar">
        <span class="step-appconfig-toolbar-hint">填写内容会自动暂存，切换步骤或离开页面后不会丢失</span>
        <el-button size="small" @click="onStash">暂 存</el-button>
      </div>
      <el-form ref="appconfigDialogFormRef" size="default" label-width="100px" :model="state.ruleForm"
        :rules="formRules" :disabled="formDisabled">
        <el-row :gutter="10">
          <el-col :span="24">
            <el-form-item label="项目管理" prop="projectId">
              <el-select filterable placeholder="请选择项目管理" size="default" v-model="state.ruleForm.projectId"
                disabled :title="workstation.draft.projectId ? '已由工作台第1步选定' : '请返回第1步选择项目'">
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
              <el-date-picker v-model="dllModeDate" type="datetimerange" :default-time="DLL_MODE_DEFAULT_TIME" range-separator="~" start-placeholder="起始日期"
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
              <el-input v-model="state.ruleForm.dllModeValue" type="textarea" :rows="3"
                placeholder="请输入DLL名称，每行一个，支持*和?通配符，顿号分隔" maxlength="2000" clearable />
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
                  :default-time="DEFAULT_DATE_TIME_START"
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
                  :default-time="DEFAULT_DATE_TIME_END"
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
                  :default-time="DEFAULT_DATE_TIME_START"
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
                  :default-time="DEFAULT_DATE_TIME_END"
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
        <el-tabs type="border-card" v-model="activeTab">
          <el-tab-pane label="WebApiHost" name="WebApiHost">
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
          <el-tab-pane label="ScheduleServer" name="ScheduleServer">
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
          <el-tab-pane label="WebClient" name="WebClient">
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
          <el-tab-pane label="WpfClient" name="WpfClient">
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
                  <el-select filterable v-model="state.ruleForm.configItems.wpfClient.serverIds" multiple
                    placeholder="请选择应用服务器" size="default" @change="onWpfClientServerChange">
                    <el-option v-for="server in serverList" :key="server.id" :label="server.name" :value="server.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <fieldset class="form-server-fieldset" v-for="(wpfServer, wpfIndex) in state.ruleForm.configItems.wpfClient
                .serverArr" :key="wpfIndex">
                <legend class="form-server-legend">{{ wpfServer.name }}</legend>
                <el-row>
                  <el-col :span="24">
                    <el-form-item label-width="0">
                      <template v-for="serverVal in wpfServer.serverPathArr[0].value" :key="serverVal.identity">
                        <el-input v-model="serverVal.path" placeholder="请输入发布路径" maxlength="200" clearable>
                          <template #prepend>发布路径</template>
                        </el-input>
                      </template>
                    </el-form-item>
                  </el-col>
                </el-row>
              </fieldset>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="SpcMonitor" name="SpcMonitor">
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
          <el-col :span="24" class="mb15">
            <el-form-item label="备份路径" prop="configItems.backupBasePath">
              <el-input v-model="state.ruleForm.configItems.backupBasePath" placeholder="选填，配置后备份到指定路径；不填则使用默认路径"
                maxlength="450" clearable></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
  </div>
</template>

<script setup lang="ts" name="appconfigDialog">
import { nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import type { FormRules } from "element-plus";
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
import { formatDate, DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END } from "@/utils/formatTime";
import { getDefaultSubObject, removeSlash, displayEnvironment } from "@/utils/other";
import { useWorkstationStore } from "@/stores/workstation";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh", "environment-change"]);

// 引入应用配置管理数据库
const appconfigDb = useAppconfigDb();
const projectDb = useProjectDb();
const serverDb = useServerDb();
const tfsDb = useTfsDb();
const gitDb = useGitDb();
const workstation = useWorkstationStore();

// 定义变量内容
const appconfigDialogFormRef = ref();
const projectList = ref<RowProjectType[]>();
const serverList = ref<RowServerType[]>();
const tfsList = ref<RowTfsType[]>();
const gitList = ref<RowGitType[]>();
const formDisabled = ref(false);
const activeTab = ref('WebApiHost');
const generateDirs = ref<string[]>([]);
const compressFiles = ref([]);
const dllModeDate = ref<[Date, Date]>();
// 日期范围选择器默认时间：起始日 00:00:00，截止日 23:59:59（覆盖截止日全天）
const DLL_MODE_DEFAULT_TIME: [Date, Date] = [DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END];
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
        serverIds: [],
        serverArr: [],
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

// 表单初始结构快照：回填 DB 行/缓存时以其为底做 merge，避免旧行缺字段导致模板取值出错
const pristineRuleForm = _.cloneDeep(state.ruleForm);

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

// 环境切换：该环境已有配置则自动带出（转为编辑该条），否则转为新增，避免保存时撞“已存在应用配置”
const onEnvironmentChange = async (val: number) => {
  const hit = await findDbAppconfig(state.ruleForm.projectId as number | null, val);
  if (hit) {
    if (hit.id === state.ruleForm.id) return;
    fillFormFromRow(hit);
    ElMessage.info(`已带出${displayEnvironment(Number(val))}环境已存的应用配置`);
    return;
  }
  if (state.ruleForm.id) {
    // 该环境暂无配置：保留当前填写内容转为新增，不动原环境的配置
    state.ruleForm.id = null;
    ElMessage.info(`${displayEnvironment(Number(val))}环境暂无应用配置，保存时将新增`);
  }
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
const onWpfClientServerChange = async (val: number[]) => {
  if (!val || val.length < 1) {
    state.ruleForm.configItems.wpfClient.serverArr = [];
    return;
  }
  // 移除
  for (let i = 0; i < state.ruleForm.configItems.wpfClient.serverArr.length; i++) {
    const wpfServer = state.ruleForm.configItems.wpfClient.serverArr[i];
    if (val.includes(Number(wpfServer.id))) continue;
    state.ruleForm.configItems.wpfClient.serverArr.splice(i, 1);
  }
  // 新增
  for (let i = 0; i < val.length; i++) {
    const wpfServer = state.ruleForm.configItems.wpfClient.serverArr.find(
      (item: SelectServerType) => item.id === val[i]
    );
    if (wpfServer) continue;
    const wServer = serverList.value?.find(
      (item: RowServerType) => item.id === val[i]
    );
    if (!wServer) continue;
    state.ruleForm.configItems.wpfClient.serverArr.push({
      id: wServer.id,
      name: wServer.name,
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

// 存量兼容：旧单服务器配置归一化为多服务器结构
const normalizeWpfClientServer = (wpfClient: WpfClientConfigType) => {
  if (!wpfClient) return;
  // 旧数据可能没有 serverIds/serverArr 字段（serverId 为 null 时），先补齐为数组，
  // 避免切换监听中访问 serverArr.length 时报错导致发布路径输入项不显示
  if (!wpfClient.serverIds) wpfClient.serverIds = [];
  if (!wpfClient.serverArr) wpfClient.serverArr = [];
  if (
    wpfClient.serverArr.length < 1 &&
    wpfClient.serverId
  ) {
    wpfClient.serverIds = [wpfClient.serverId];
    wpfClient.serverArr = [
      {
        id: wpfClient.serverId,
        name: wpfClient.serverName,
        serverPathArr: [
          {
            label: "",
            value: [{ identity: "", path: wpfClient.serverPath || "" }],
          },
        ],
      },
    ];
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
  state.ruleForm.configItems.wpfClient.serverIds = [];
  state.ruleForm.configItems.wpfClient.serverArr = [];
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

// 将数据库行回填到表单（openDialog 编辑分支与工作台“自动带出”共用）
const fillFormFromRow = (row: RowAppconfigType | any) => {
  if (!row) return;
  // 以初始结构为底 merge：旧行缺新增字段时补默认值，避免模板取值出错
  state.ruleForm = _.merge(_.cloneDeep(pristineRuleForm), row);
  normalizeWpfClientServer(state.ruleForm.configItems.wpfClient);
  generateDirs.value = [];
  if (state.ruleForm.configItems.wpfClient.generateDirJson) {
    try {
      generateDirs.value = JSON.parse(
        state.ruleForm.configItems.wpfClient.generateDirJson
      );
    } catch { /* 兼容脏数据 */ }
  }
  compressFiles.value = [];
  if (state.ruleForm.configItems.wpfClient.compressFileJson) {
    try {
      compressFiles.value = JSON.parse(
        state.ruleForm.configItems.wpfClient.compressFileJson
      );
    } catch { /* 兼容脏数据 */ }
  }

  dllModeDate.value = undefined;
  if (state.ruleForm.dllModeValue && state.ruleForm.dllMode == "日期范围") {
    try {
      const dateJson = JSON.parse(state.ruleForm.dllModeValue as string);
      dllModeDate.value = [new Date(dateJson[0]), new Date(dateJson[1])];
    } catch { /* 兼容脏数据 */ }
  }

  if (state.ruleForm.dllModeValue && state.ruleForm.dllMode == "TFS") {
    try { selectTfsItem.value = JSON.parse(state.ruleForm.dllModeValue as string); } catch { /* 兼容脏数据 */ }
  }

  if (state.ruleForm.dllModeValue && state.ruleForm.dllMode == "Git") {
    try { selectGitItem.value = JSON.parse(state.ruleForm.dllModeValue as string); } catch { /* 兼容脏数据 */ }
  }
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
      fillFormFromRow(row);

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

// —— 工作台内联适配：与 src/stores/workstation 的 draft 双向同步 ——
let restoring = false;

// 查询项目已存的应用配置；fallbackAny=true 时无精确环境匹配则回退取任意环境第一条（按环境升序）
const findDbAppconfig = async (
  projectId: number | null,
  environment: number | null,
  fallbackAny = false
): Promise<RowAppconfigType | null> => {
  if (!projectId) return null;
  try {
    const r = await appconfigDb.getAppconfigList({
      projectId,
      environment: null,
      sorting: "ta.environment ASC",
      skipCount: 0,
      maxResultCount: 1000,
    });
    if (r.code !== 0) return null;
    const rows = r.data?.data || [];
    if (environment != null) {
      const hit = rows.find(
        (x: any) => Number(x.environment) === Number(environment)
      );
      if (hit) return hit;
    }
    return fallbackAny && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
};

// 将当前表单同步至工作台草稿（供 StepPreview 聚合与 canPublish 判断）
const syncValidatedDraft = () => {
  const payload: any = {
    id: state.ruleForm.id,
    projectId: state.ruleForm.projectId,
    projectName: (state.ruleForm as any).projectName || null,
    environment: state.ruleForm.environment,
    msBuildPath: state.ruleForm.msBuildPath,
    dllMode: state.ruleForm.dllMode,
    dllModeValue: state.ruleForm.dllModeValue,
    buildMode: state.ruleForm.buildMode,
    configItemsJson: state.ruleForm.configItemsJson,
    configItems: JSON.parse(JSON.stringify(state.ruleForm.configItems)),
  };
  (workstation as any).draft.appconfigDraft = payload;
  (workstation as any).draft.publishOptions = {
    isBackup: (state.ruleForm.configItems as any).isBackup as number,
    isNewVersion: (state.ruleForm.configItems as any).isNewVersion as boolean | null,
    backupBasePath: (state.ruleForm.configItems as any).backupBasePath as string | undefined,
  } as any;
  (workstation as any).persist();
};

// 暂存：未校验的表单快照写入工作台草稿，切换步骤/离开页面后可完整恢复
const stashFormCache = () => {
  const snap: any = {
    projectId: ((workstation as any).draft?.projectId ?? state.ruleForm.projectId) as number | null,
    savedAt: Date.now(),
    ruleForm: JSON.parse(JSON.stringify(state.ruleForm)),
    generateDirs: JSON.parse(JSON.stringify(generateDirs.value || [])),
    compressFiles: JSON.parse(JSON.stringify(compressFiles.value || [])),
    dllModeDate: dllModeDate.value
      ? [String(dllModeDate.value[0]), String(dllModeDate.value[1])]
      : null,
    selectTfsItem: JSON.parse(JSON.stringify(selectTfsItem.value)),
    selectGitItem: JSON.parse(JSON.stringify(selectGitItem.value)),
  };
  (workstation as any).draft.appconfigFormCache = snap;
  (workstation as any).persist();
};

// “暂 存”按钮：立即快照并提示
const onStash = () => {
  if (stashTimer) clearTimeout(stashTimer);
  stashFormCache();
  ElMessage.success("已暂存当前应用配置内容");
};

// 表单变化自动暂存（防抖 600ms），防止手滑离开后内容被清空
let stashTimer: any = null;
watch(
  [() => state.ruleForm, selectTfsItem, selectGitItem, generateDirs, compressFiles, dllModeDate],
  () => {
    if (restoring) return;
    if (stashTimer) clearTimeout(stashTimer);
    stashTimer = setTimeout(() => stashFormCache(), 600);
  },
  { deep: true }
);
onBeforeUnmount(() => {
  if (stashTimer) clearTimeout(stashTimer);
  if (!restoring) stashFormCache();
});

// 从表单缓存恢复（含日期选择器等辅助 ref）
const restoreFormFromCache = (c: any) => {
  state.ruleForm = _.merge(_.cloneDeep(pristineRuleForm), c.ruleForm || {});
  if (c.generateDirs) generateDirs.value = c.generateDirs;
  if (c.compressFiles) compressFiles.value = c.compressFiles;
  if (c.dllModeDate) {
    const d0 = new Date(c.dllModeDate[0]);
    const d1 = new Date(c.dllModeDate[1]);
    dllModeDate.value =
      !isNaN(d0.getTime()) && !isNaN(d1.getTime()) ? ([d0, d1] as [Date, Date]) : undefined;
  } else {
    dllModeDate.value = undefined;
  }
  if (c.selectTfsItem) selectTfsItem.value = c.selectTfsItem;
  if (c.selectGitItem) selectGitItem.value = c.selectGitItem;
};

const syncFromWorkstation = async () => {
  restoring = true;
  try {
    const draft: any = (workstation as any).draft;
    const acDraft: any = draft?.appconfigDraft;
    const pid = draft?.projectId as number | null;
    const tfsId = draft?.tfsId as number | null;
    const gitId = draft?.gitId as number | null;
    if (pid) state.ruleForm.projectId = pid;

    // 1) 优先恢复未校验的表单缓存（仅同项目有效，防止换项目后带回旧配置）
    let restored = false;
    const cache: any = draft?.appconfigFormCache;
    if (
      cache &&
      Object.keys(cache).length > 0 &&
      cache.ruleForm &&
      cache.projectId === pid
    ) {
      restoreFormFromCache(cache);
      restored = true;
    }

    // 2) 恢复已校验通过的应用配置草稿（同样校验项目归属）
    if (
      !restored &&
      acDraft &&
      Object.keys(acDraft).length > 0 &&
      (acDraft.projectId == null || acDraft.projectId === pid)
    ) {
      restored = true;
      if (acDraft.id != null) state.ruleForm.id = acDraft.id;
      if (acDraft.environment != null) state.ruleForm.environment = acDraft.environment;
      if (acDraft.buildMode) state.ruleForm.buildMode = acDraft.buildMode;
      if (acDraft.dllMode) state.ruleForm.dllMode = acDraft.dllMode;
      if (acDraft.dllModeValue !== undefined) state.ruleForm.dllModeValue = acDraft.dllModeValue;
      if (acDraft.msBuildPath !== undefined) state.ruleForm.msBuildPath = acDraft.msBuildPath;
      if (acDraft.configItems) {
        Object.assign(state.ruleForm.configItems, JSON.parse(JSON.stringify(acDraft.configItems)));
        // 同步 Wpf 生成目录的辅助 ref
        if ((acDraft.configItems as any)?.wpfClient?.generateDirJson) {
          try { generateDirs.value = JSON.parse((acDraft.configItems as any).wpfClient.generateDirJson); } catch {}
        }
        if ((acDraft.configItems as any)?.wpfClient?.compressFileJson) {
          try { compressFiles.value = JSON.parse((acDraft.configItems as any).wpfClient.compressFileJson); } catch {}
        }
      }
      if (acDraft.dllModeValue && acDraft.dllMode === '日期范围') {
        try { const arr = JSON.parse(String(acDraft.dllModeValue)); dllModeDate.value = [new Date(arr[0]), new Date(arr[1])]; } catch {}
      }
      if (acDraft.dllModeValue && acDraft.dllMode === 'TFS') {
        try { selectTfsItem.value = JSON.parse(String(acDraft.dllModeValue)); } catch {}
      }
      if (acDraft.dllModeValue && acDraft.dllMode === 'Git') {
        try { selectGitItem.value = JSON.parse(String(acDraft.dllModeValue)); } catch {}
      }
    }

    // 3) 无任何草稿时自动带出该项目已存的应用配置，否则保存时会撞“已存在应用配置”
    if (!restored && pid) {
      const hit = await findDbAppconfig(pid, state.ruleForm.environment, true);
      if (hit) {
        fillFormFromRow(hit);
        state.ruleForm.projectId = pid;
        syncValidatedDraft();
        ElMessage.info(
          `已带出${displayEnvironment(Number(state.ruleForm.environment))}环境的应用配置，可直接修改后进入下一步`
        );
      }
    }

    // 4) 首次填写（未带出任何配置）且第 2 步已选 TFS/Git：默认回填对应 dllMode，允许用户后续切回“全部”
    if (!restored && !state.ruleForm.id) {
      if (tfsId && !gitId) {
        state.ruleForm.dllMode = 'TFS';
        selectTfsItem.value.id = tfsId;
        try {
          const r: any = await tfsDb.getTfsList({ tfsName: null, tfsSourcePath: null, sorting: 'id DESC', skipCount: 0, maxResultCount: 1000 });
          const found = (r?.data?.data || []).find((x: any) => x.id === tfsId);
          if (found) selectTfsItem.value.tfsName = found.tfsName;
        } catch {}
      } else if (gitId) {
        // 含 gitId 时优先 Git（双选时亦然，与原对话框单选一致）
        state.ruleForm.dllMode = 'Git';
        selectGitItem.value.id = gitId;
        try {
          const r: any = await gitDb.getGitList({ gitName: null, gitRepository: null, sorting: 'id DESC', skipCount: 0, maxResultCount: 1000 });
          const found = (r?.data?.data || []).find((x: any) => x.id === gitId);
          if (found) selectGitItem.value.gitName = found.gitName;
        } catch {}
      } else {
        // 无 TFS/Git 时保持“全部”作为可跳过默认
        if (!state.ruleForm.dllMode) state.ruleForm.dllMode = '全部';
      }
    }

    // 刷新项目/服务器列表并保持 projectId 锁定为工作台已选
    await getProjectList();
    await getTfsList();
    await getGitList();
    if (state.ruleForm.projectId) await getServerList(state.ruleForm.projectId as number);
  } finally {
    await nextTick();
    restoring = false;
    try { appconfigDialogFormRef.value?.clearValidate(); } catch {}
  }
};

// 工作台 Step 校验：复用原表单校验并同步至 workstation draft，同时落库到 t_app_config
const validate = async (): Promise<boolean> => {
  if (!appconfigDialogFormRef.value) return false;
  // 用回调式 validate 以拿到 fields，做 Tab 联动与精确定位
  const { valid, fields } = await new Promise<{ valid: boolean; fields?: any }>(resolve => {
    (appconfigDialogFormRef.value as any).validate((v: boolean, f: any) => resolve({ valid: v, fields: f }));
  });
  if (!valid) {
    // 1) 汇总首个错误字段名，2) 若错误在某模块 Tab 内则自动切 Tab，3) 滚动到首个错误
    const firstField = fields ? Object.keys(fields)[0] : '';
    const fieldMap: Record<string, string> = {
      'configItems.webApiHost.clientPath': 'WebApiHost',
      'configItems.scheduleServer.clientPath': 'ScheduleServer',
      'configItems.webClient.clientPath': 'WebClient',
      'configItems.wpfClient.clientPath': 'WpfClient',
      'configItems.spcMonitor.clientPath': 'SpcMonitor',
      'configItems.wpfClient.generateDirJson': 'WpfClient',
      'configItems.wpfClient.compressFileJson': 'WpfClient',
    };
    let targetTab = '';
    for (const k of Object.keys(fields || {})) {
      for (const prefix of Object.keys(fieldMap)) {
        if (k.startsWith(prefix)) { targetTab = fieldMap[prefix]; break; }
      }
      if (targetTab) break;
    }
    // 若错误在 Wpf 等 Tab 内，尝试切到对应 Tab（el-tabs 的 v-model 为 activeName，默认按 label 匹配）
    if (targetTab) {
      activeTab.value = targetTab;
      ElMessage.warning(`请检查“${targetTab}”中的必填项：${firstField}`);
    } else {
      const firstMsg = fields?.[firstField]?.[0]?.message || '请检查应用配置必填项';
      ElMessage.warning(firstMsg);
    }
    // 滚动到首个错误字段
    try { (appconfigDialogFormRef.value as any).scrollToField(firstField); } catch {}
    return false;
  }
  if (!state.ruleForm.projectId) { ElMessage.warning('请先选择项目'); return false; }
  // 序列化前与原 onSubmit 一致：处理 TFS/Git 的 dllModeValue
  state.ruleForm.configItemsJson = JSON.stringify(state.ruleForm.configItems);
  if (state.ruleForm.dllMode == "TFS" && (selectTfsItem as any).value?.id) {
    const sel: any = JSON.parse(JSON.stringify((selectTfsItem as any).value));
    for (let i = 0; i < sel.selectValue.length; i++) {
      const v: any = sel.selectValue[i].value;
      if (sel.selectModel == "日期" && v) {
        let d: any = v;
        if (typeof d === 'string') d = new Date(d);
        sel.selectValue[i].value = formatDate(d, "YYYY-mm-dd HH:MM:SS");
      }
    }
    state.ruleForm.dllModeValue = JSON.stringify(sel);
  }
  if (state.ruleForm.dllMode == "Git" && (selectGitItem as any).value?.id) {
    const sel: any = JSON.parse(JSON.stringify((selectGitItem as any).value));
    for (let i = 0; i < sel.selectValue.length; i++) {
      const v: any = sel.selectValue[i].value;
      if (sel.selectModel == "日期" && v) {
        let d: any = v;
        if (typeof d === 'string') d = new Date(d);
        sel.selectValue[i].value = formatDate(d, "YYYY-mm-dd HH:MM:SS");
      }
    }
    state.ruleForm.dllModeValue = JSON.stringify(sel);
  }

  // —— 落库到 t_app_config（与原对话框 onSubmit 一致），保证“保存到实际表” —— //
  try {
    let dbResult: any = null;
    if (state.ruleForm.id) {
      dbResult = await appconfigDb.updateAppconfig(state.ruleForm as any);
    } else {
      dbResult = await appconfigDb.insertAppconfig(state.ruleForm as any);
      if (dbResult?.code === 0 && dbResult?.data) state.ruleForm.id = dbResult.data;
    }
    if (!dbResult || dbResult.code !== 0) {
      ElMessage.error(dbResult?.msg || '保存应用配置失败');
      return false;
    }
    if (dbResult.code === 0) ElMessage.success(state.ruleForm.id ? '应用配置已更新' : '应用配置已保存');
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.message || String(e)}`);
    return false;
  }

  // 同步至工作台草稿（供 StepPreview 聚合）
  syncValidatedDraft();
  return true;
};

// 初始化：内联模式下直接挂载即同步工作台草稿
import { onMounted as onMountedInline } from 'vue';
onMountedInline(async () => {
  await syncFromWorkstation();
});

// 暴露给工作台壳的 Step 校验
defineExpose({
  validate,
  // 保留原 openDialog 供兼容（不再弹窗，内联已直接可见）
  openDialog,
});
</script>
<style lang="scss">
.el-overlay .el-overlay-dialog .el-dialog .el-dialog__body {
  padding: 0px !important;
}
</style>
<style lang="scss" scoped>
.step-appconfig-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.step-appconfig-toolbar-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

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
