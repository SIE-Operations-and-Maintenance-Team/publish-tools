<template>
  <div class="git-dialog-container">
    <el-dialog :title="state.dialog.title" v-model="state.dialog.show" :close-on-click-modal="false"
      modal-class="git-dialog" draggable width="680px">
      <el-form ref="gitDialogFormRef" size="default" label-width="110px" :model="state.ruleForm" :rules="formRules">
        <el-row :gutter="10">
          <el-col :span="24" class="mb20">
            <el-form-item label="Git名称">
              <el-input v-model="state.ruleForm.gitName" maxlength="50" clearable :disabled="formDisabled"
                placeholder="请输入Git名称"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label=".git目录">
              <el-input v-model="state.ruleForm.gitRepository" maxlength="500" clearable :disabled="formDisabled"
                placeholder="请输入本地.git目录"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label="Git工具路径">
              <el-input v-model="state.ruleForm.gitPath" maxlength="500" clearable :disabled="formDisabled"
                placeholder="请输入Git工具路径，如：git"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label="">
              <div class="git-info-text">
                <el-text type="info"># Git工具(Git.exe)<br />一般位于：C:\Program Files\Git\bin\git.exe</el-text>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label="默认分支">
              <el-input v-model="state.ruleForm.branchName" maxlength="150" clearable :disabled="formDisabled"
                placeholder="请输入默认分支名称，默认为master"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label="备注">
              <el-input v-model="state.ruleForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit
                :disabled="formDisabled" placeholder="请输入备注信息"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default">取 消</el-button>
          <el-button type="primary" @click="submitValidate(gitDialogFormRef)" size="default">{{ state.dialog.submitTxt
          }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="gitDialog">
import { nextTick, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import _ from "lodash";
import { getDefaultSubObject } from "@/utils/other";
import { useGitDb } from "@/database/git/index";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh"]);

// 引入Git数据库
const gitDb = useGitDb();

// 定义变量内容
const gitDialogFormRef = ref<FormInstance>();
const formDisabled = ref(false);
const state = reactive<FormDialogType<RowGitType>>({
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
    type: "add",
    editId: null,
    title: "新增Git",
    submitTxt: "确 定",
  },
});

// 表单验证规则
const formRules = reactive<FormRules>({
  gitName: [{ required: true, message: "请输入Git名称！", trigger: "blur" }],
  gitRepository: [{ required: true, message: "请输入本地.git目录！", trigger: "blur" }],
  gitPath: [{ required: true, message: "请输入Git工具路径！", trigger: "blur" }],
});

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
  if (state.dialog.type == "edit") {
    // 修改
    let updateResult = await gitDb.updateGit(state.ruleForm);
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
  let insertResult = await gitDb.insertGit(state.ruleForm);
  if (insertResult.code === 0) {
    ElMessage.success("添加成功！");
    closeDialog(); // 关闭弹窗
    emit("refresh");
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 打开弹窗
const openDialog = (type: string, row: RowGitType | null) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.dialog.editId = null;
  state.dialog.type = "add";
  /* End: 重置表单内容 */
  nextTick(() => {
    if (type === "edit" && row) {
      state.dialog.type = "edit";
      state.dialog.editId = row.id;
      Object.assign(state.ruleForm, row);
      state.dialog.title = "修改Git";
      state.dialog.submitTxt = "修 改";
    } else if (type === "viewer" && row) {
      state.dialog.type = "viewer";
      Object.assign(state.ruleForm, row);
      state.dialog.title = "查看Git";
      state.dialog.submitTxt = "关 闭";
      formDisabled.value = true;
    } else {
      state.dialog.title = "新增Git";
      state.dialog.submitTxt = "确 定";
    }
    state.dialog.show = true;
  });
};

// 取消
const onCancel = () => {
  state.dialog.show = false;
};

// 关闭弹窗
const closeDialog = () => {
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

.git-dialog-container {
  .dialog-footer {
    display: flex;
    justify-content: center;
    align-items: center;
  }
}
.git-info-text {
  padding: 5px;
  background-color: #eef0f4;
  border-radius: 2px;
  word-wrap: break-word;
  word-break: break-all;
  line-height: 20px;
}
</style>