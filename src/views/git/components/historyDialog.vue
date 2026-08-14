<template>
  <div class="git-history-dialog-container">
    <el-dialog :title="state.dialog.title" v-model="state.dialog.show" width="700px" :close-on-click-modal="false"
      modal-class="git-history-dialog" draggable>
      <template #default>
        <el-form ref="gitHistoryDialogFormRef" size="default" label-width="110px" :model="state.ruleForm"
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
                      :default-time="DEFAULT_DATE_TIME_START"
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
                      :default-time="DEFAULT_DATE_TIME_END"
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
              </el-row>
            </fieldset>
          </el-row>
        </el-form>
      </template>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default">取 消</el-button>
          <el-button type="primary" :loading="state.dialog.submitTxt === '执行中'"
            @click="submitValidate(gitHistoryDialogFormRef)" size="default">{{ state.dialog.submitTxt }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 结果展示弹窗 -->
    <el-dialog v-model="resultDialog.visible" :title="resultDialog.title" width="60%" draggable resizable
      :before-close="handleResultClose">
      <pre class="result-content">{{ resultDialog.content }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="gitHistoryDialog">
import { reactive, ref } from "vue";
import { cmdInvoke } from "@/utils/command";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import _ from "lodash";
import { getDefaultSubObject } from "@/utils/other";
import { formatDate, DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END } from "@/utils/formatTime";
import { parseGitContent } from "@/utils/outPublishInfo";

// 定义变量内容
const gitHistoryDialogFormRef = ref<FormInstance>();
const formDisabled = ref(false);
const currentPage = ref(1);
const total = ref(0);
// 结果弹窗状态
const resultDialog = reactive({
  visible: false,
  title: '',
  content: ''
});

// 定义Git历史记录项的类型
interface GitHistoryItem {
  commitSha: string;
  author: string;
  date: string;
  message: string;
  files: Array<{ status: string, path: string }>
}

// Git历史数据
const gitHistoryData = ref<GitHistoryItem[]>([]);

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

const state = reactive<any>({
  ruleForm: {
    id: null,
    gitName: null,
    gitRepository: null,
    gitPath: null,
    branchName: "master",
    remark: null,
  },
  dialog: {
    show: false,
    type: "viewer",
    editId: null,
    title: "Git记录",
    submitTxt: "查 询",
  },
});

// 表单验证规则
const formRules = reactive<FormRules>({
  gitName: [{ required: true, message: "请输入Git名称！", trigger: "blur" }],
  gitRepository: [{ required: true, message: "请输入本地.git目录！", trigger: "blur" }],
  branchName: [{ required: true, message: "请输入分支名称！", trigger: "blur" }],
});

// Git记录筛选条件变化
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
  if (!state.ruleForm.gitRepository) {
    ElMessage.error('Git仓库目录不能为空！');
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

    const execResult = await cmdInvoke("execute_local_command_with_working_dir", {
      command: state.ruleForm.gitPath,
      args: execArgs,
      workingDir: state.ruleForm.gitRepository
    });

    if (execResult.code !== 0) {
      ElMessage.error(`命令执行失败：${execResult.data}`);
      state.dialog.submitTxt = "查 询";
      return;
    }

    // 显示执行结果
    resultDialog.title = 'Git历史记录查询结果';
    // 检查是否有查询结果
    if (!execResult.data || execResult.data.trim() === '') {
      resultDialog.content = '找不到与指定的项和版本组合有关的历史记录项';
    } else {
      // 解析Git内容并格式化显示
      const gitCommits = await parseGitContent(execResult.data);
      if (gitCommits.length === 0) {
        resultDialog.content = '找不到与指定的项和版本组合有关的历史记录项';
      } else {
        // 格式化显示Git提交记录
        const formattedCommits = gitCommits.map(commit => {
          console.log('commit', commit)
          // 确保提交ID和提交信息不包含引号
          const cleanId = String(commit.id).replace(/"/g, '');
          const cleanComment = commit.commentText.replace(/"$/g, ''); // 去除末尾的引号
          return `提交: ${cleanId}
作者: ${commit.user}
日期: ${commit.dateTime}
信息: ${cleanComment}
变更文件:${('\n')}${commit.items.length > 0 ? commit.items.join('\n') : '无'}`
        }).join('\n-------------------------------------------------------------------------------\n');

        resultDialog.content = formattedCommits;
      }
    }
    resultDialog.visible = true;

  } catch (error) {
    console.error('Git history error:', error);
    ElMessage.error('执行Git命令时发生错误: ' + (error as Error).message);
  } finally {
    state.dialog.submitTxt = "查 询";
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

// 关闭结果弹窗
const handleResultClose = (done: () => void) => {
  resultDialog.visible = false;
  done();
};

// 打开弹窗
const openDialog = (type: string, row: RowGitType) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.dialog.editId = null;
  state.dialog.type = "add";
  gitHistoryData.value = [];
  currentPage.value = 1;
  total.value = 0;
  /* End: 重置表单内容 */

  if (type === "viewer") {
    state.dialog.type = "viewer";
    Object.assign(state.ruleForm, row);
    state.dialog.title = "Git记录";
    state.dialog.submitTxt = "查 询";
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

.git-history-dialog-container {
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
}

.range-separator {
  text-align: center;
  height: 32px;
  line-height: 32px;
}
</style>