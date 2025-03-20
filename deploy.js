import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'ssh2';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
let config;
try {
  const configFile = path.join(__dirname, 'deploy-config.json');
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch (error) {
  console.error('Error loading configuration:', error.message);
  console.error('Make sure deploy-config.json exists and is properly formatted');
  process.exit(1);
}

// Function to execute shell commands
async function runCommand(command) {
  console.log(`Executing: ${command}`);
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error(`Error executing command: ${error.message}`);
    throw error;
  }
}

// Function to establish SSH connection
function createSSHConnection() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('SSH Connection established');
        resolve(conn);
      })
      .on('error', (err) => {
        console.error('SSH Connection error:', err.message);
        reject(err);
      })
      .connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password
      });
  });
}

// Function to execute remote command via SSH
function executeRemoteCommand(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      
      let stdout = '';
      let stderr = '';
      
      stream
        .on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}: ${stderr}`));
          } else {
            resolve(stdout);
          }
        })
        .on('data', (data) => {
          stdout += data.toString();
          console.log(data.toString());
        })
        .stderr.on('data', (data) => {
          stderr += data.toString();
          console.error(data.toString());
        });
    });
  });
}

// Function to upload entire project via SCP
function uploadProject(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      
      const localPath = __dirname;
      const remotePath = config.remotePath;
      
      // List of directories and files to exclude
      const excludeList = [
        'node_modules',
        '.git',
        'dist',
        'deploy-config.json',
        'db.json'
      ];
      
      // Function to recursively upload a directory
      async function uploadDir(localDir, remoteDir) {
        console.log(`Uploading directory: ${localDir} -> ${remoteDir}`);
        
        // Create remote directory if it doesn't exist
        try {
          await new Promise((resolve, reject) => {
            sftp.mkdir(remoteDir, (err) => {
              if (err && err.code !== 4) { // Ignore 'directory already exists' error
                reject(err);
              } else {
                resolve();
              }
            });
          });
        } catch (error) {
          console.log(`Remote directory ${remoteDir} already exists`);
        }
        
        // Get all files and directories in the local directory
        const items = fs.readdirSync(localDir, { withFileTypes: true });
        
        for (const item of items) {
          // Skip excluded items
          if (excludeList.includes(item.name)) {
            console.log(`Skipping excluded item: ${item.name}`);
            continue;
          }
          
          const localItemPath = path.join(localDir, item.name);
          const remoteItemPath = `${remoteDir}/${item.name}`;
          
          if (item.isDirectory()) {
            // Recursively upload subdirectory
            await uploadDir(localItemPath, remoteItemPath);
          } else {
            // Upload file
            console.log(`Uploading file: ${localItemPath} -> ${remoteItemPath}`);
            await new Promise((resolve, reject) => {
              sftp.fastPut(localItemPath, remoteItemPath, (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            });
          }
        }
      }
      
      // Start uploading the project
      uploadDir(localPath, remotePath)
        .then(() => {
          console.log('Upload completed successfully');
          resolve();
        })
        .catch((error) => {
          console.error('Upload failed:', error.message);
          reject(error);
        });
    });
  });
}

// Main deployment function
async function deploy() {
  try {
    // Check if this is a first-time deployment
    const isFirstTime = process.argv.includes('--first-time');

    // Step 1: Build the project
    console.log('========== Building project ==========');
    await runCommand('npm run build');
    
    // Step 2: Establish SSH connection
    console.log('========== Connecting to remote server ==========');
    const conn = await createSSHConnection();
    
    try {
      // Step 3: Upload entire project
      console.log('========== Uploading project files ==========');
      await uploadProject(conn);
      
      // Step 4: Install dependencies on the remote server
      console.log('========== Installing dependencies on remote server ==========');
      await executeRemoteCommand(conn, `cd ${config.remotePath} && npm install --production`);
      
      // Step 5: Start or restart PM2 service
      if (isFirstTime) {
        console.log('========== First-time deployment: Starting PM2 ==========');
        await executeRemoteCommand(conn, `cd ${config.remotePath} && pm2 start ecosystem.config.cjs`);
        
        // Optionally save PM2 process list to auto-start on server reboot
        console.log('========== Saving PM2 process list ==========');
        await executeRemoteCommand(conn, 'pm2 save');
        console.log('PM2 process list saved. If you want PM2 to auto-start on server reboot, run:');
        console.log('pm2 startup');
        console.log('And follow the instructions on the remote server');
      } else {
        console.log('========== Restarting PM2 service ==========');
        await executeRemoteCommand(conn, `pm2 restart ${config.pm2AppName}`);
      }
      
      console.log('========== Deployment completed successfully ==========');
    } finally {
      // Always close the connection
      conn.end();
    }
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run the deployment
deploy(); 