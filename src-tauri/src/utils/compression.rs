use std::fs;
use std::fs::File;
use std::io;
use std::io::{BufReader, BufWriter, Error, Read, Write};
use std::path::Path;
use walkdir::WalkDir;
use zip::{write::FileOptions, CompressionMethod, ZipArchive};

///
/// 创建压缩文件
///
/// # Arguments
/// * `file_paths` - 文件|文件夹路径
/// * `dst_file` - 输出的zip文件路径
///
/// # Returns
/// * `ZipResult` 压缩结果
pub fn create_zip(file_paths: &[&str], dst_file: &str) -> zip::result::ZipResult<()> {
    let zip_file = File::create(dst_file)?;
    let mut zip = zip::ZipWriter::new(BufWriter::new(zip_file));

    let options = FileOptions::default()
        .compression_method(CompressionMethod::Stored) // 你可以改变压缩方法
        .unix_permissions(0o755);

    let mut buffer = Vec::new();

    for file_path in file_paths {
        let src_path = Path::new(file_path);

        if src_path.is_file() {
            // 处理单个文件
            let name = src_path.file_name().unwrap().to_str().unwrap();
            zip.start_file(name, options)?;
            let mut f = File::open(src_path)?;
            f.read_to_end(&mut buffer)?;
            zip.write_all(&buffer)?;
            buffer.clear();
        } else if src_path.is_dir() {
            // 处理整个目录
            let dir_name = src_path.file_name().unwrap().to_str().unwrap();
            for entry in WalkDir::new(src_path) {
                match entry {
                    Ok(entry) => {
                        let path = entry.path();
                        let name = path.strip_prefix(src_path).unwrap().to_str().unwrap();
                        if path.is_file() {
                            zip.start_file(format!("{}/{}", dir_name, name), options)?;
                            let mut f = File::open(path)?;
                            f.read_to_end(&mut buffer)?;
                            zip.write_all(&buffer)?;
                            buffer.clear();
                        } else if path.is_dir() {
                            zip.add_directory(format!("{}/{}", dir_name, name), options)?;
                        }
                    }
                    Err(e) => {
                        eprintln!("Error walking directory: {}", e);
                        return Err(zip::result::ZipError::FileNotFound);
                    }
                }
            }
        } else {
            return Err(zip::result::ZipError::FileNotFound);
        }
    }
    zip.finish()?;
    Ok(())
}

///
/// 解压压缩文件
///
/// # Arguments
/// * `file_paths` - 文件路径
/// * `destination` - 输出解压路径
///
/// # Returns
/// * `OK(true)` 成功
/// * `Err` 失败
pub fn unzip_files(file_paths: &[&str], destination: &str) -> Result<bool, Error> {
    for file_path in file_paths {
        // 打开 zip 文件
        let file = File::open(file_path)?;
        let mut archive = ZipArchive::new(BufReader::new(file))?;

        // 遍历 archive 中的所有文件
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = Path::new(destination).join(file.name());

            // 如果文件有上级目录，则进行目录创建
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent)?;
            }

            // 判断是否为目录
            if file.name().ends_with('/') {
                std::fs::create_dir_all(&outpath)?;
            } else {
                // 创建文件并写入内容
                let mut outfile = File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }

            // 设置权限（在 Unix 系统上生效）
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    std::fs::set_permissions(&outpath, std::fs::Permissions::from_mode(mode))?;
                }
            }
        }
    }
    Ok(true)
}

///
/// 读取文件目录中的文件
///
/// # Arguments
/// * `path` - 文件目录
///
/// # Returns
/// * `OK` 成功
/// * `Err` 失败
pub fn read_dir_files(path: &str) -> io::Result<Vec<String>> {
    let mut file_names = Vec::new();
    let path = Path::new(path);
    if path.is_dir() {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name() {
                    if let Some(file_name_str) = file_name.to_str() {
                        file_names.push(file_name_str.to_string());
                    }
                }
            }
        }
    } else {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "提供的路径不是目录.",
        ));
    }

    Ok(file_names)
}
