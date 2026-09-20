Write-Host "🐳 Démarrage de l'application Document Archive..." -ForegroundColor Cyan
Write-Host ""

# 1. Démarrer tous les services
Write-Host "📦 Démarrage des conteneurs..." -ForegroundColor Yellow
docker-compose up -d --build

# 2. Attendre que les services soient prêts
Write-Host ""
Write-Host "⏳ Attente du démarrage des services (30s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 3. Vérifier que les services tournent
Write-Host ""
Write-Host "🔍 Vérification des services..." -ForegroundColor Yellow

# Backend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing
    Write-Host "✅ Backend: OK" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Backend: pas encore prêt" -ForegroundColor Yellow
}

# Qdrant
try {
    $response = Invoke-WebRequest -Uri "http://localhost:6333/health" -UseBasicParsing
    Write-Host "✅ Qdrant: OK" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Qdrant: pas encore prêt" -ForegroundColor Yellow
}

# Ollama
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing
    Write-Host "✅ Ollama: OK" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Ollama: pas encore prêt" -ForegroundColor Yellow
}

# 4. Télécharger les modèles Ollama
Write-Host ""
Write-Host "📥 Téléchargement des modèles Ollama (peut prendre 5-10 min)..." -ForegroundColor Yellow
docker exec doc_archive_ollama ollama pull nomic-embed-text
docker exec doc_archive_ollama ollama pull llama3.2:latest

# 5. Initialiser la base de données
Write-Host ""
Write-Host "🗄️ Initialisation de la base de données..." -ForegroundColor Yellow
docker exec doc_archive_backend npm run docker:init

Write-Host ""
Write-Host "🎉 Application prête !" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Accès:" -ForegroundColor Cyan
Write-Host "   Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "   Backend:   http://localhost:5000" -ForegroundColor White
Write-Host "   Qdrant:    http://localhost:6333/dashboard" -ForegroundColor White
Write-Host "   Ollama:    http://localhost:11434" -ForegroundColor White
Write-Host ""
Write-Host "👤 Identifiants admin:" -ForegroundColor Cyan
Write-Host "   Email:     admin@documentarchive.com" -ForegroundColor White
Write-Host "   Password:  Admin@123" -ForegroundColor White
Write-Host ""
Write-Host "🛑 Pour arrêter: docker-compose down" -ForegroundColor Red