# 内容营销智能体 - 部署指南

本文档详细说明了如何将内容营销智能体部署到生产服务器。

---

## 📑 目录

- [服务器要求](#服务器要求)
- [部署方式选择](#部署方式选择)
- [方案一：Docker 部署（推荐）](#方案一docker-部署推荐)
- [方案二：PM2 部署](#方案二pm2-部署)
- [方案三：Systemd 部署](#方案三systemd-部署)
- [SSL 证书配置](#ssl-证书配置)
- [域名配置](#域名配置)
- [监控与日志](#监控与日志)
- [备份策略](#备份策略)
- [故障排查](#故障排查)

---

## 服务器要求

### 最低配置

- **CPU**: 2 核
- **内存**: 4GB RAM
- **存储**: 40GB SSD
- **操作系统**: Ubuntu 22.04 LTS / Debian 11+
- **带宽**: 5 Mbps

### 推荐配置

- **CPU**: 4 核
- **内存**: 8GB RAM
- **存储**: 80GB SSD
- **操作系统**: Ubuntu 22.04 LTS
- **带宽**: 10 Mbps

---

## 部署方式选择

| 方案 | 难度 | 隔离性 | 性能 | 推荐场景 |
|------|------|--------|------|----------|
| **Docker** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 生产环境、多服务部署 |
| **PM2** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 快速部署、单服务 |
| **Systemd** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | Linux 原生、精细控制 |

---

## 方案一：Docker 部署（推荐）

### 优势

✅ 完全隔离环境
✅ 一键部署和迁移
✅ 版本控制方便
✅ 资源限制精确
✅ 易于扩展

### 步骤 1：安装 Docker

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 步骤 2：准备代码

```bash
# 克隆代码
git clone your-repo-url
cd content-factory

# 复制环境变量模板
cp .env.production.example .env.production

# 编辑环境变量
vim .env.production
```

### 步骤 3：构建并启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps
```

### 步骤 4：更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose up -d --build

# 清理旧镜像
docker image prune -a -f
```

---

## 方案二：PM2 部署

### 优势

✅ 配置简单
✅ 自动重启
✅ 集群模式支持
✅ 性能监控

### 步骤 1：初始化服务器

```bash
# 运行初始化脚本
sudo chmod +x deploy/scripts/init-server.sh
sudo ./deploy/scripts/init-server.sh
```

### 步骤 2：部署代码

```bash
# 克隆代码到服务器
cd /var/www
git clone your-repo-url content-factory
cd content-factory

# 设置权限
sudo chown -R www-data:www-data /var/www/content-factory
```

### 步骤 3：配置环境变量

```bash
# 复制环境变量模板
cp .env.production.example .env.production

# 编辑配置
vim .env.production
```

### 步骤 4：启动应用

```bash
# 运行启动脚本
chmod +x scripts/pm2-start.sh
./scripts/pm2-start.sh

# 或手动启动
pm2 start ecosystem.config.cjs --env production

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

### 步骤 5：PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启应用
pm2 restart all

# 停止应用
pm2 stop all

# 删除应用
pm2 delete all

# 监控
pm2 monit
```

---

## 方案三：Systemd 部署

### 优势

✅ Linux 原生支持
✅ 开机自启
✅ 日志管理完善
✅ 资源限制精确

### 步骤 1-3：同 PM2 部署

### 步骤 4：配置服务

```bash
# 复制服务文件
sudo cp deploy/systemd/content-factory-app.service /etc/systemd/system/
sudo cp deploy/systemd/content-factory-cron.service /etc/systemd/system/

# 重新加载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start content-factory-app
sudo systemctl start content-factory-cron

# 设置开机自启
sudo systemctl enable content-factory-app
sudo systemctl enable content-factory-cron
```

### 步骤 5：管理服务

```bash
# 查看状态
sudo systemctl status content-factory-app

# 查看日志
sudo journalctl -u content-factory-app -f

# 重启服务
sudo systemctl restart content-factory-app

# 停止服务
sudo systemctl stop content-factory-app
```

---

## SSL 证书配置

### 使用 Let's Encrypt（免费）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书（自动配置 Nginx）
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 测试自动续期
sudo certbot renew --dry-run

# 查看证书信息
sudo certbot certificates
```

### 手动配置 SSL

如果已有证书，修改 Nginx 配置：

```nginx
ssl_certificate /path/to/your/fullchain.pem;
ssl_certificate_key /path/to/your/privkey.pem;
```

---

## 域名配置

### DNS 记录

| 类型 | 名称 | 值 | TTL |
|------|------|-----|-----|
| A | @ | 你的服务器 IP | 600 |
| A | www | 你的服务器 IP | 600 |
| CNAME | mail | mail.yourdomain.com | 600 |

### 配置 Nginx

编辑 `deploy/nginx/content-factory.conf`：

```nginx
server_name yourdomain.com www.yourdomain.com;
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/content-factory /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 监控与日志

### 查看应用日志

```bash
# PM2
pm2 logs

# Systemd
sudo journalctl -u content-factory-app -f

# Docker
docker-compose logs -f

# Nginx 访问日志
sudo tail -f /var/log/nginx/content-factory-access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/content-factory-error.log
```

### 设置日志轮转

创建 `/etc/logrotate.d/content-factory`：

```
/var/log/content-factory/*.log
/var/www/content-factory/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload content-factory-app > /dev/null 2>&1 || true
    endscript
}
```

---

## 备份策略

### 数据库备份

创建备份脚本 `backup.sh`：

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/content-factory"
DATA_DIR="/var/www/content-factory/data"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
cp $DATA_DIR/app.db $BACKUP_DIR/app.db.$DATE

# 压缩备份
gzip $BACKUP_DIR/app.db.$DATE

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: app.db.$DATE.gz"
```

设置定时任务：

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /var/www/content-factory/scripts/backup.sh
```

### 完整备份

```bash
#!/bin/bash

# 完整备份脚本
BACKUP_DIR="/var/backups/content-factory"
APP_DIR="/var/www/content-factory"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
tar -czf $BACKUP_DIR/data-$DATE.tar.gz -C $APP_DIR data

# 备份上传文件
tar -czf $BACKUP_DIR/uploads-$DATE.tar.gz -C $APP_DIR uploads

# 备份环境变量
cp $APP_DIR/.env.production $BACKUP_DIR/.env.production.$DATE

# 上传到远程服务器（可选）
# rsync -avz $BACKUP_DIR user@backup-server:/backups/

echo "Full backup completed: $DATE"
```

---

## 故障排查

### 应用无法启动

```bash
# 检查端口占用
sudo netstat -tlnp | grep :3000

# 检查日志
pm2 logs
# 或
sudo journalctl -u content-factory-app -n 50

# 检查环境变量
cat .env.production

# 手动启动测试
NODE_ENV=production npm run start
```

### Nginx 502 错误

```bash
# 检查应用是否运行
pm2 status

# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 数据库错误

```bash
# 检查数据库文件权限
ls -la data/app.db

# 修复权限
chmod 664 data/app.db
chown www-data:www-data data/app.db

# 检查数据库完整性
sqlite3 data/app.db "PRAGMA integrity_check;"
```

### 内存不足

```bash
# 查看内存使用
free -h

# 查看 Node.js 进程内存
ps aux | grep node

# 增加 swap 空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 性能优化

### 启用 HTTP/2

Nginx 配置中已包含 HTTP/2 支持。

### 启用 Brotli 压缩

```bash
sudo apt install brotli
```

在 Nginx 配置中添加：

```nginx
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
```

### 配置缓存

```nginx
# 静态资源缓存
location /_next/static {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# API 缓存（谨慎使用）
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;
```

---

## 安全加固

### 配置防火墙

```bash
# 安装 UFW
sudo apt install ufw

# 允许必要端口
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 配置 Fail2Ban

已在初始化脚本中配置。

### 定期更新

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 更新应用
cd /var/www/content-factory
git pull origin main
npm ci
npm run build
pm2 restart all
```

---

## 扩展部署

### 使用 PM2 集群模式

修改 `ecosystem.config.cjs`：

```javascript
{
  instances: 'max', // 使用所有 CPU 核心
  exec_mode: 'cluster'
}
```

### 负载均衡

使用 Nginx 配置多个后端：

```nginx
upstream content_factory_backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

---

## 联系支持

如有问题，请联系：
- Email: support@yourdomain.com
- GitHub Issues: your-repo/issues

---

**最后更新**: 2025-01-17
