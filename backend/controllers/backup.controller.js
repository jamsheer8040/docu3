const path = require('path');
const fs = require('fs');
const backupUtil = require('../utils/backup.util');
const companyBackupsInProgress = new Set();

exports.requireCompanyAdmin = (req, res, next) => {
  if (req.user?.Role?.type !== 'Internal' || req.user.Role.name?.toLowerCase() !== 'admin' || !Number.isSafeInteger(Number(req.user.tenant_id)) || Number(req.user.tenant_id) <= 0) {
    return res.status(403).json({ success: false, message: 'Only the company administrator can manage its database backups.' });
  }
  next();
};

exports.validateCompanyImport = async (req,res) => {
  try {
    if(!req.file)return res.status(400).json({success:false,message:'Choose a company SQL backup.'});
    const data=await require('../utils/companyRestore').preview(req.file.buffer,Number(req.user.tenant_id),req.user,req.body.mode);
    res.set('Cache-Control','no-store');res.json({success:true,data});
  }catch(error){res.status(error.status||400).json({success:false,message:error.status?error.message:'The backup could not be validated. Check that it matches this application version.'});}
};
exports.importCompanyBackup = async (req,res) => {
  const tenantId=Number(req.user.tenant_id);
  if(companyBackupsInProgress.has(tenantId))return res.status(409).json({success:false,message:'Another company backup or import is in progress.'});
  companyBackupsInProgress.add(tenantId);
  try {
    if(!req.file)return res.status(400).json({success:false,message:'Choose a company SQL backup.'});
    const data=await require('../utils/companyRestore').restore(req.file.buffer,tenantId,req.user,req.body);
    res.set('Cache-Control','no-store');res.json({success:true,data});
  }catch(error){res.status(error.status||400).json({success:false,message:error.status?error.message:'Import failed. No changes were applied.',recovery:error.recovery});}
  finally{companyBackupsInProgress.delete(tenantId);}
};
exports.latestCompanyRecovery = async (req,res,next) => {
  try {
    const restore=require('../utils/companyRestore'),folder=path.dirname(restore.recoveryPath(Number(req.user.tenant_id),'restore-safety-00000000-0000-0000-0000-000000000000.sql'));
    const files=await fs.promises.readdir(folder).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
    const records=await Promise.all(files.filter(file=>restore.recoveryPattern.test(file)).map(async file=>({id:file,created_at:(await fs.promises.stat(path.join(folder,file))).mtime.toISOString()})));
    records.sort((a,b)=>b.created_at.localeCompare(a.created_at));res.set('Cache-Control','no-store');res.json({success:true,data:records[0]||null});
  }catch(error){next(error);}
};
exports.downloadCompanyRecovery = async (req,res) => {
  try {
    const filePath=require('../utils/companyRestore').recoveryPath(Number(req.user.tenant_id),req.params.id);
    await fs.promises.access(filePath);res.set('Cache-Control','no-store, private');res.download(filePath,req.params.id);
  }catch{res.status(404).json({success:false,message:'Recovery backup not found.'});}
};

exports.downloadCompanyBackup = async (req, res, next) => {
  const tenantId = Number(req.user.tenant_id);
  if (companyBackupsInProgress.has(tenantId)) return res.status(409).json({ success: false, message: 'A company backup is already being prepared. Please wait.' });
  companyBackupsInProgress.add(tenantId);
  const abort = new AbortController();
  const onClose = () => abort.abort();
  res.once('close', onClose);
  let backup;
  try {
    // The tenant always comes from the verified session; payload IDs are ignored.
    backup = await require('../utils/companyBackup').createCompanyBackup(tenantId, { signal: abort.signal });
    if (abort.signal.aborted) { await backup.cleanup(); return; }
    res.set({ 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' });
    res.type('application/sql');
    await new Promise((resolve, reject) => res.download(backup.filePath, backup.filename, error => error ? reject(error) : resolve()));
  } catch (error) {
    if (!res.headersSent && !res.destroyed) next(error);
  } finally {
    res.removeListener('close', onClose);
    if (backup) await backup.cleanup().catch(error => console.error('[CompanyBackup] Cleanup failed:', error.message));
    companyBackupsInProgress.delete(tenantId);
  }
};

exports.getBackups = async (req, res, next) => {
  try {
    const backups = backupUtil.listBackups();
    res.json({
      success: true,
      schedule: {
        time: '02:00 AM',
        timezone: 'Asia/Dubai (UAE Time)',
        retentionDays: 7
      },
      data: backups
    });
  } catch (error) {
    next(error);
  }
};

exports.createBackupManual = async (req, res, next) => {
  try {
    const result = await backupUtil.createBackup();
    res.json({
      success: true,
      message: `Database backup created successfully: ${result.filename}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.downloadBackupFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(backupUtil.BACKUP_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Backup file not found' });
    }

    res.download(filePath, safeFilename);
  } catch (error) {
    next(error);
  }
};

exports.deleteBackupFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    backupUtil.deleteBackup(filename);
    res.json({
      success: true,
      message: `Backup file ${filename} deleted successfully.`
    });
  } catch (error) {
    next(error);
  }
};
