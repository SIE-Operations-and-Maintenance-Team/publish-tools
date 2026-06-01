<template>
  <div class="git-log-dialog-container">
    <el-dialog :title="state.dialog.title" v-model="state.dialog.show" width="700px" :close-on-click-modal="false"
      modal-class="git-log-dialog" draggable>
      <template #default>
        <el-form ref="gitLogDialogFormRef" size="default" label-width="110px" :model="state.ruleForm"
          :rules="formRules">
          <el-row :gutter="10">
            <el-col :span="24" class="mb20">
              <el-form-item label="Git名称">
                <el-input v-model="state.ruleForm.gitName" maxlength="50" clearable :disabled="formDisabled"
                  placeholder="请输入Git名称"></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="14" class="mb20">
              <el-form-item label=".git目录">
                <el-input v-model="state.ruleForm.gitRepository" maxlength="500" clearable :disabled="formDisabled"
                  placeholder="请输入本地.git目录"></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="10" class="mb20">
              <el-form-item label="分支名称">
                <el-input v-model="state.ruleForm.branchName" maxlength="150" clearable
                  placeholder="请输入分支名称，默认master"></el-input>
              </el-form-item>
            </el-col>
            <fieldset class="form-git-fieldset">
              <legend class="form-git-legend">筛选条件</legend>
              <el-row :gutter="0">
                <el-col :span="24" class="mb10" style="text-align: center">
                  <div class="history-filter-item">
                    <el-radio-group v-model="historyParams.historyModel" @change="onHistoryModelChange">
                      <el-radio-button label="日期" value="日期" />
                      <el-radio-button label="提交" value="提交" />
                    </el-radio-group>
                  </div>
                </el-col>
                <el-col :span="11" class="mb10">
                  <el-form-item :label="historyParams.historyModel">
                    <el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
                      v-model="historyParams.historyValue[0].value" type="datetime"
                      :placeholder="historyParams.historyValue[0].placeholder" />
                    <el-input v-else v-model="historyParams.historyValue[0].value"
                      :placeholder="historyParams.historyValue[0].placeholder" maxlength="150" />
                  </el-form-item>
                </el-col>
                <el-col :span="1" class="mb10">
                  <div class="range-separator">~</div>
                </el-col>
                <el-col :span="11" class="mb10">
                  <el-form-item label-width="0px">
                    <el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
                      v-model="historyParams.historyValue[1].value" type="datetime"
                      :placeholder="historyParams.historyValue[1].placeholder" />
                    <el-input v-else v-model="historyParams.historyValue[1].value"
                      :placeholder="historyParams.historyValue[1].placeholder" maxlength="150" clearable />
                  </el-form-item>
                </el-col>
                <el-col :span="11" class="mb10">
                  <el-form-item label="作者">
                    <el-input v-model="historyParams.author" placeholder="请输入作者名称" clearable maxlength="150" />
                  </el-form-item>
                </el-col>
                <el-col :span="12" class="mb10">
                  <el-form-item label="生成方式">
                    <el-select v-model="generateGitLog.type" placeholder="请选择生成方式" size="default"
                      style="min-width: 50px">
                      <el-option label="默认" value="默认" />
                      <el-option label="仅提交列表" value="仅提交列表" />
                      <el-option label="按日期" value="按日期" />
                      <el-option label="按作者" value="按作者" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="23" class="mb10" v-show="generateGitLog.type !== '仅提交列表'">
                  <el-form-item label="生成信息(包含)">
                    <el-checkbox v-model="generateGitLog.displayPublishField.isCommit" size="default" label="提交SHA" />
                    <el-checkbox v-model="generateGitLog.displayPublishField.isDateTime" size="default" label="日期" />
                    <el-checkbox v-model="generateGitLog.displayPublishField.isAuthor" size="default" label="作者" />
                    <el-checkbox v-model="generateGitLog.displayPublishField.isDll" size="default" label="DLL" />
                  </el-form-item>
                </el-col>
              </el-row>
            </fieldset>
          </el-row>
        </el-form>
        <el-form v-if="generateGitLog.content" :model="generateGitLog" label-width="110px">
          <el-form-item label="生成内容">
            <div class="form-content-ipt">
              <el-input v-model="generateGitLog.content" type="textarea" :rows="8" readonly
                placeholder="生成的内容将显示在这里"></el-input>
            </div>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default">取 消</el-button>
          <el-button type="primary" :loading="state.dialog.submitTxt === '执行中'"
            @click="submitValidate(gitLogDialogFormRef)" size="default">{{ state.dialog.submitTxt }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="gitLogDialog">
import { reactive, ref } from "vue";
import { cmdInvoke } from "@/utils/command";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage, ElMessageBox } from "element-plus";
import _ from "lodash";
import { getDefaultSubObject } from "@/utils/other";
import { formatDate } from "@/utils/formatTime";
import {
  outPublishContents,
  outDetaultPublishContents,
  outPublishContentByDates,
  outPublishContentByUsers,
} from "@/utils/outPublishInfo";

// 定义变量内容
const gitLogDialogFormRef = ref<FormInstance>();
const formDisabled = ref(false);
const historyParams = ref({
  historyModel: "日期",
  historyValue: [
    {
      placeholder: "开始日期(必填)",
      value: "",
    },
    {
      placeholder: "结束日期(选填，空则表示为最新日期)",
      value: "",
    },
  ],
  author: "",
});

// 生成Git日志
const generateGitLog = ref({
  type: "默认",
  displayPublishField: {
    isCommit: true,
    isAuthor: true,
    isDateTime: true,
    isDll: true,
  } as any,
  content: "",
});

const state = reactive<any>({
  ruleForm: {
    id: null,
    gitName: null,
    gitRepository: null,
    gitPath: null,
    branchName: "master",
  },
  dialog: {
    show: false,
    type: "viewer",
    editId: null,
    title: "生成日志信息",
    submitTxt: "确 定",
  },
});

// 表单验证规则
const formRules = reactive<FormRules>({
  gitName: [{ required: true, message: "请输入Git名称！", trigger: "blur" }],
  gitRepository: [{ required: true, message: "请输入本地.git目录！", trigger: "blur" }],
  branchName: [{ required: true, message: "请输入分支名称！", trigger: "blur" }],
});

// 历史记录筛选条件变化
const onHistoryModelChange = (val: string) => {
  historyParams.value.historyModel = val;
  if (val === "日期") {
    const { start, end } = getWeekStartEnd();
    historyParams.value.historyValue = [
      {
        placeholder: "开始日期(必填)",
        value: start,
      },
      {
        placeholder: "结束日期(选填，空则表示为最新日期)",
        value: end,
      },
    ];
  } else {
    historyParams.value.historyValue = [
      {
        placeholder: "提交SHA(必填)",
        value: "",
      },
      {
        placeholder: "提交SHA(选填，空则表示为最新提交)",
        value: "",
      },
    ];
  }
};

// 提交验证
const submitValidate = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    if (valid) {
      onSubmit();
    } else {
      console.warn("未验证通过!", fields);
    }
  });
};

// 提交
const onSubmit = async () => {
  // 验证
  if (!historyParams.value.historyValue[0].value) {
    ElMessage.error(`${historyParams.value.historyValue[0].placeholder}不能为空！`);
    return;
  }
  state.dialog.submitTxt = "执行中";

  try {
    // Git命令执行
    let execArgs = new Array<string>();
    execArgs.push("log");
    execArgs.push("--pretty=format:%H|%an|%ae|%ad|%s"); // 格式化输出
    execArgs.push("--name-status"); // 包含文件变更状态
    console.log('historyParams', historyParams)

    // SHA查询
    if (historyParams.value.historyModel === "commit") {
      const startSha = historyParams.value.historyValue[0].value;
      const endSha = historyParams.value.historyValue[1].value;

      // 如果只填写了起始SHA，则查询从该SHA到HEAD的所有提交（包含起始SHA）
      if (startSha && !endSha) {
        execArgs.push(`${startSha}..HEAD`);
      }
      // 如果填写了起始和结束SHA，则查询范围（包含起始SHA和结束SHA）
      else if (startSha && endSha) {
        execArgs.push(`${startSha}^..${endSha}`);
      }
      // 如果只填写了结束SHA（理论上不应该发生）
      else if (!startSha && endSha) {
        execArgs.push(endSha);
      }
    }

    // 时间范围筛选
    if (historyParams.value.historyModel === "日期") {
      let sDate = new Date(historyParams.value.historyValue[0].value);
      const beginDate = formatDate(sDate, "DYYYY-mm-ddTHH:MM:SS");

      let endDate = new Date();
      if (historyParams.value.historyValue[1].value) {
        endDate = new Date(historyParams.value.historyValue[1].value);
      }
      const formattedEndDate = formatDate(endDate, "DYYYY-mm-ddTHH:MM:SS");

      execArgs.push(`--since=${beginDate}`);
      execArgs.push(`--until=${formattedEndDate}`);
    }

    // 作者筛选
    if (historyParams.value.author) {
      execArgs.push(`--author=${historyParams.value.author}`);
    }

    // 分支
    execArgs.push(state.ruleForm.branchName);
    console.log('execArgs', execArgs);

    // 执行git命令
    const execResult = await cmdInvoke("execute_local_command_with_working_dir", {
      command: state.ruleForm.gitPath,
      args: execArgs,
      workingDir: state.ruleForm.gitRepository,
    });

    console.log(execResult);

    if (execResult.code !== 0) {
      ElMessage.error(`Git命令执行失败：${execResult.data}`);
      state.dialog.submitTxt = "确 定";
      return;
    }

    if (!execResult.data || execResult.data.trim() === '') {
      ElMessage.error('找不到与指定的项和版本组合有关历史记录项');
    } else {
      // 处理生成日志的结果
      let generateResult: DataResultType = {
        code: 1,
        msg: "success",
        data: null,
      };

      const dllResolveOptions = { repositoryPath: state.ruleForm.gitRepository };
      switch (generateGitLog.value.type) {
        case "仅发布内容":
          generateResult = await outPublishContents(execResult.data, "", false);
          break;
        case "按日期":
          generateResult = await outPublishContentByDates(
            execResult.data,
            generateGitLog.value.displayPublishField,
            "",
            false,
            dllResolveOptions
          );
          break;
        case "按作者":
          generateResult = await outPublishContentByUsers(
            execResult.data,
            generateGitLog.value.displayPublishField,
            "",
            false,
            dllResolveOptions
          );
          break;
        default:
          generateResult = await outDetaultPublishContents(
            execResult.data,
            generateGitLog.value.displayPublishField,
            "",
            false,
            dllResolveOptions
          );
          break;
      }

      if (generateResult.code === 0) {
        ElMessageBox.alert(`<pre style="white-space: pre-wrap; word-wrap: break-word; max-height: 60vh; overflow-y: auto;">${generateResult.msg}</pre>`, "Git日志生成结果", {
          dangerouslyUseHTMLString: true,
          confirmButtonText: "知道了",
          type: "success",
          center: true
        });
      }
    }
  } catch (error) {
    console.error('Git log error:', error);
    ElMessage.error('执行Git命令时发生错误: ' + (error as Error).message);
  } finally {
    state.dialog.submitTxt = "确 定";
  }
};

// 工具函数
const getWeekStartEnd = () => {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一
  const start = new Date(now.setDate(diffToMonday));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

// 打开弹窗
const openDialog = (type: string, row: RowGitType) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.dialog.editId = null;
  state.dialog.type = "add";
  generateGitLog.value.content = "";
  /* End: 重置表单内容 */

  if (type === "viewer") {
    state.dialog.type = "viewer";
    Object.assign(state.ruleForm, row);
    state.dialog.title = "生成日志信息";
    state.dialog.submitTxt = "确 定";
    formDisabled.value = true;
  }

  const { start, end } = getWeekStartEnd();
  historyParams.value.historyValue[0].value = start;
  historyParams.value.historyValue[1].value = end;

  state.dialog.show = true;
};

// 取消
const onCancel = () => {
  state.dialog.show = false;
  generateGitLog.value.content = "";
};

// 定义类型
interface RowGitType {
  id: number | null;
  gitName: string | null;
  gitRepository: string | null;
  gitPath: string | null;
  branchName: string | null;
  remark: string | null;
}

// 暴露方法
defineExpose({
  openDialog,
});
</script>

<style scoped lang="scss">
@import "@/theme/mixins/index.scss";

.git-log-dialog-container {
  .form-git-fieldset {
    width: 100%;
    border: 1px #dcdfe6 solid;
    padding-top: 2px;
    margin: 0px 5px;

    .history-filter-item {
      text-align: center;
    }
  }

  .form-git-legend {
    padding: 0px 5px;
    margin-left: 15px;
  }

  .history-filter-item {
    display: flex;
    justify-content: center;
    margin: 10px 0;
  }

  .form-content-ipt {
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: hidden;

    :deep(.el-textarea__inner) {
      border: none !important;
      outline: none;
      resize: none;
      min-height: 100px !important;
    }
  }
}

.range-separator {
  text-align: center;
  height: 32px;
  line-height: 32px;
}
</style>