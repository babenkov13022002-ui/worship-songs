// Подключаем Firebase
import { db, auth, storage } from './firebase-config.js';

class WorshipSongsApp {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.songs = [];
        this.playlists = [];
        this.favorites = [];
        this.currentSong = null;
        this.currentUser = null;
        this.isOnline = navigator.onLine;
        this.pendingChanges = [];
        
        // Правильное музыкальное транспонирование
        this.chordTheory = {
            // Все тональности в правильном порядке (круг квинт)
            keys: ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'],
            // Аккорды и их семитоновые значения
            chords: {
                'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
                'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
                'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
                // Минорные аккорды
                'Cm': 0, 'C#m': 1, 'Dbm': 1, 'Dm': 2, 'D#m': 3, 'Ebm': 3,
                'Em': 4, 'Fm': 5, 'F#m': 6, 'Gbm': 6, 'Gm': 7, 'G#m': 8,
                'Abm': 8, 'Am': 9, 'A#m': 10, 'Bbm': 10, 'Bm': 11,
                // Сложные аккорды (определяем базовую ноту)
                'C7': 0, 'G7': 7, 'Am7': 9, 'Dm7': 2, 'Em7': 4,
                'Fmaj7': 5, 'Gsus4': 7, 'Csus2': 0
            },
            // Знаки при ключе для каждой тональности
            keySignatures: {
                'C': { sharps: 0, flats: 0 },
                'G': { sharps: 1, flats: 0 },
                'D': { sharps: 2, flats: 0 },
                'A': { sharps: 3, flats: 0 },
                'E': { sharps: 4, flats: 0 },
                'B': { sharps: 5, flats: 0 },
                'F#': { sharps: 6, flats: 0 },
                'C#': { sharps: 7, flats: 0 },
                'G#': { sharps: 8, flats: 0 },
                'D#': { sharps: 9, flats: 0 },
                'A#': { sharps: 10, flats: 0 },
                'F': { sharps: 0, flats: 1 },
                'Bb': { sharps: 0, flats: 2 },
                'Eb': { sharps: 0, flats: 3 },
                'Ab': { sharps: 0, flats: 4 },
                'Db': { sharps: 0, flats: 5 },
                'Gb': { sharps: 0, flats: 6 }
            }
        };
        
        this.init();
    }

    async init() {
        // Инициализация Telegram
        this.tg.expand();
        this.tg.enableClosingConfirmation();
        
        // Загрузка пользователя из Telegram
        this.initTelegramUser();
        
        // Инициализация интерфейса
        this.initUI();
        this.initEvents();
        this.initFirebase();
        
        // Загрузка данных
        await this.loadData();
        
        // Показ приложения
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            this.showToast('Добро пожаловать в Worship Songs!', 'success');
        }, 1500);
    }

    initTelegramUser() {
        const tgUser = this.tg.initDataUnsafe.user;
        if (tgUser) {
            this.currentUser = {
                id: tgUser.id.toString(),
                firstName: tgUser.first_name,
                lastName: tgUser.last_name,
                username: tgUser.username,
                photoUrl: tgUser.photo_url,
                isAdmin: this.checkIfAdmin(tgUser.id)
            };
            
            // Обновляем профиль
            document.getElementById('user-name').textContent = 
                tgUser.first_name || 'Участник';
            document.getElementById('user-role').textContent = 
                this.currentUser.isAdmin ? 'Администратор' : 'Участник команды';
        }
    }

    checkIfAdmin(userId) {
        // Список администраторов (можно вынести в Firebase)
        const adminIds = ['123456789', '987654321']; // Замените на реальные ID
        return adminIds.includes(userId.toString());
    }

    async initFirebase() {
        try {
            // Подписываемся на обновления песен в реальном времени
            db.collection('songs').onSnapshot((snapshot) => {
                const changes = snapshot.docChanges();
                changes.forEach(change => {
                    if (change.type === 'added' || change.type === 'modified') {
                        this.updateSongInList(change.doc.data());
                    } else if (change.type === 'removed') {
                        this.removeSongFromList(change.doc.id);
                    }
                });
                this.updateSyncIndicator('synced');
            });
            
            // Подписываемся на плейлисты
            db.collection('playlists').onSnapshot((snapshot) => {
                this.playlists = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderPlaylists();
                this.updateCounters();
            });
            
            // Отслеживаем онлайн-статус
            window.addEventListener('online', () => this.handleOnlineStatus(true));
            window.addEventListener('offline', () => this.handleOnlineStatus(false));
            
        } catch (error) {
            console.error('Ошибка Firebase:', error);
            this.showToast('Ошибка подключения к серверу', 'error');
        }
    }

    updateSyncIndicator(status) {
        const indicator = document.getElementById('sync-indicator');
        if (!indicator) return;
        
        indicator.className = `sync-indicator ${status}`;
        indicator.innerHTML = status === 'syncing' 
            ? '<i class="fas fa-sync fa-spin"></i> Синхронизация...'
            : status === 'synced'
            ? '<i class="fas fa-check-circle"></i> Синхронизировано'
            : '<i class="fas fa-exclamation-circle"></i> Ошибка синхронизации';
    }

    async loadData() {
        try {
            // Загрузка из Firebase
            const songsSnapshot = await db.collection('songs').get();
            this.songs = songsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const playlistsSnapshot = await db.collection('playlists').get();
            this.playlists = playlistsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Загрузка избранного из localStorage
            const savedFavorites = localStorage.getItem('worship_favorites');
            this.favorites = savedFavorites ? JSON.parse(savedFavorites) : [];
            
            this.renderSongs();
            this.renderPlaylists();
            this.updateCounters();
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showToast('Используем локальные данные', 'warning');
            // Загрузка из localStorage как запасной вариант
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const savedSongs = localStorage.getItem('worship_songs');
        const savedPlaylists = localStorage.getItem('worship_playlists');
        
        if (savedSongs) {
            this.songs = JSON.parse(savedSongs);
            this.renderSongs();
        }
        
        if (savedPlaylists) {
            this.playlists = JSON.parse(savedPlaylists);
            this.renderPlaylists();
        }
    }

    saveToFirebase(collection, data, id = null) {
        this.updateSyncIndicator('syncing');
        
        if (id) {
            return db.collection(collection).doc(id).set(data, { merge: true });
        } else {
            return db.collection(collection).add(data);
        }
    }

    async saveSong(songData, isNew = true) {
        try {
            const song = {
                ...songData,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser?.id || 'anonymous'
            };
            
            if (isNew) {
                song.createdAt = new Date().toISOString();
                song.createdBy = this.currentUser?.id || 'anonymous';
                const docRef = await this.saveToFirebase('songs', song);
                song.id = docRef.id;
            } else {
                await this.saveToFirebase('songs', song, songData.id);
            }
            
            this.showToast('Песня сохранена!', 'success');
            return song;
            
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.showToast('Ошибка сохранения', 'error');
            // Сохраняем локально для синхронизации позже
            this.queuePendingChange('songs', songData, isNew ? 'add' : 'update');
            return null;
        }
    }

    async deleteSong(songId) {
        try {
            await db.collection('songs').doc(songId).delete();
            this.showToast('Песня удалена', 'success');
        } catch (error) {
            console.error('Ошибка удаления:', error);
            this.showToast('Ошибка удаления', 'error');
            this.queuePendingChange('songs', { id: songId }, 'delete');
        }
    }

    queuePendingChange(collection, data, action) {
        this.pendingChanges.push({
            collection,
            data,
            action,
            timestamp: Date.now()
        });
        
        localStorage.setItem('pending_changes', JSON.stringify(this.pendingChanges));
        this.showToast('Изменения сохранены локально', 'info');
    }

    async syncPendingChanges() {
        if (!this.pendingChanges.length || !this.isOnline) return;
        
        this.updateSyncIndicator('syncing');
        
        for (const change of this.pendingChanges) {
            try {
                if (change.action === 'add' || change.action === 'update') {
                    await this.saveToFirebase(change.collection, change.data, change.data.id);
                } else if (change.action === 'delete') {
                    await db.collection(change.collection).doc(change.data.id).delete();
                }
            } catch (error) {
                console.error('Ошибка синхронизации:', error);
                break;
            }
        }
        
        // Удаляем синхронизированные изменения
        this.pendingChanges = [];
        localStorage.removeItem('pending_changes');
        this.updateSyncIndicator('synced');
    }

    // ПРАВИЛЬНОЕ ТРАНСПОНИРОВАНИЕ АККОРДОВ
    transposeChord(chord, semitones) {
        if (!chord || chord.trim() === '') return chord;
        
        // Регулярное выражение для поиска аккордов
        const chordRegex = /([A-G][#b]?)(m?(?:aj|min|dim|aug|sus)?(?:[2-9]|11|13)?(?:\/[A-G][#b]?)?)/g;
        
        return chord.replace(chordRegex, (match, note, extension) => {
            // Находим базовую ноту
            const baseNote = note;
            const baseNoteIndex = this.chordTheory.chords[baseNote];
            
            if (baseNoteIndex === undefined) return match;
            
            // Вычисляем новую ноту
            let newIndex = (baseNoteIndex + semitones + 12) % 12;
            
            // Находим новое имя ноты
            let newNote = Object.keys(this.chordTheory.chords).find(key => 
                this.chordTheory.chords[key] === newIndex && 
                key.length === baseNote.length && 
                (key.includes('#') === baseNote.includes('#') || 
                 key.includes('b') === baseNote.includes('b'))
            ) || baseNote;
            
            // Убираем возможные дубликаты (например, C# и Db)
            if (newNote.includes('#')) {
                newNote = newNote.replace('b', '');
            } else if (newNote.includes('b')) {
                newNote = newNote.replace('#', '');
            }
            
            return newNote + extension;
        });
    }

    transposeSongLyrics(lyrics, fromKey, toKey) {
        if (!lyrics || !fromKey || !toKey) return lyrics;
        
        // Вычисляем разницу в полутонах
        const fromIndex = this.chordTheory.chords[fromKey];
        const toIndex = this.chordTheory.chords[toKey];
        
        if (fromIndex === undefined || toIndex === undefined) return lyrics;
        
        const semitones = (toIndex - fromIndex + 12) % 12;
        
        // Транспонируем каждый аккорд в тексте
        const lines = lyrics.split('\n');
        const transposedLines = lines.map(line => {
            // Разделяем строку на аккорды и текст
            const chordMatches = line.match(/\[([^\]]+)\]/g);
            
            if (!chordMatches) return line;
            
            let newLine = line;
            chordMatches.forEach(match => {
                const chord = match.slice(1, -1); // Убираем скобки
                const transposedChord = this.transposeChord(chord, semitones);
                newLine = newLine.replace(match, `[${transposedChord}]`);
            });
            
            return newLine;
        });
        
        return transposedLines.join('\n');
    }

    // ОБНОВЛЕННЫЙ РЕНДЕРИНГ ПЕСЕН С КНОПКАМИ
    renderSongs(filteredSongs = null) {
        const songsList = document.getElementById('songs-list');
        const songsToShow = filteredSongs || this.songs;
        
        songsList.innerHTML = '';
        
        songsToShow.forEach(song => {
            const isFavorite = this.favorites.includes(song.id);
            const songEl = document.createElement('div');
            songEl.className = 'song-item glass-card draggable';
            songEl.dataset.songId = song.id;
            songEl.innerHTML = `
                <div class="song-cover" style="background: ${this.getGradientForSong(song.id)}">
                    <i class="fas fa-music"></i>
                </div>
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                    <div class="song-meta">
                        <span class="key-badge">${song.key}</span>
                        <span>${this.getCategoryName(song.category)}</span>
                        ${song.updatedAt ? `<span class="updated-time">${this.formatDate(song.updatedAt)}</span>` : ''}
                    </div>
                </div>
                <div class="song-actions-mini">
                    <button class="icon-btn small favorite-btn ${isFavorite ? 'active' : ''}" 
                            data-song-id="${song.id}" title="${isFavorite ? 'Удалить из избранного' : 'В избранное'}">
                        <i class="fas ${isFavorite ? 'fa-star' : 'fa-star'}"></i>
                    </button>
                    <button class="icon-btn small context-btn" data-song-id="${song.id}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            `;
            
            // Клик по песне
            songEl.addEventListener('click', (e) => {
                if (!e.target.closest('.song-actions-mini')) {
                    this.showSongModal(song);
                }
            });
            
            // Кнопка избранного
            const favBtn = songEl.querySelector('.favorite-btn');
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(song.id);
            });
            
            // Контекстное меню
            const contextBtn = songEl.querySelector('.context-btn');
            contextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showContextMenu(e, song);
            });
            
            // Drag & drop
            songEl.setAttribute('draggable', 'true');
            songEl.addEventListener('dragstart', (e) => this.handleDragStart(e, song.id));
            songEl.addEventListener('dragover', (e) => this.handleDragOver(e));
            songEl.addEventListener('drop', (e) => this.handleDrop(e, song.id));
            
            songsList.appendChild(songEl);
        });
        
        document.getElementById('songs-count').textContent = songsToShow.length;
    }

    showContextMenu(e, song) {
        const menu = document.getElementById('song-context-menu');
        menu.classList.remove('hidden');
        
        // Позиционирование
        const x = e.clientX;
        const y = e.clientY;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        
        // Закрытие при клике вне меню
        const closeMenu = () => {
            menu.classList.add('hidden');
            document.removeEventListener('click', closeMenu);
        };
        
        setTimeout(() => document.addEventListener('click', closeMenu), 100);
        
        // Обработка действий
        menu.querySelectorAll('.context-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleContextAction(action, song);
                closeMenu();
            };
        });
    }

    handleContextAction(action, song) {
        switch(action) {
            case 'edit':
                this.editSong(song);
                break;
            case 'delete':
                this.confirmDeleteSong(song);
                break;
            case 'copy':
                this.copySongToClipboard(song);
                break;
            case 'share':
                this.shareSong(song);
                break;
            case 'favorite':
                this.toggleFavorite(song.id);
                break;
            case 'transpose':
                this.showQuickTranspose(song);
                break;
        }
    }

    editSong(song) {
        // Заполняем форму редактирования
        document.getElementById('song-title').value = song.title;
        document.getElementById('song-artist').value = song.artist;
        document.getElementById('song-key').value = song.key;
        document.getElementById('song-category').value = song.category;
        document.getElementById('song-lyrics').value = song.lyrics;
        
        // Показываем модалку с кнопкой "Обновить"
        const saveBtn = document.getElementById('save-song-btn');
        saveBtn.innerHTML = '<i class="fas fa-sync"></i> Обновить';
        saveBtn.dataset.songId = song.id;
        saveBtn.dataset.isEdit = 'true';
        
        document.getElementById('add-song-modal').classList.remove('hidden');
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    confirmDeleteSong(song) {
        document.getElementById('delete-song-title').textContent = song.title;
        document.getElementById('delete-confirm-modal').classList.remove('hidden');
        document.getElementById('modal-overlay').classList.remove('hidden');
        
        document.getElementById('confirm-delete').onclick = () => {
            this.deleteSong(song.id);
            this.closeAllModals();
        };
        
        document.getElementById('cancel-delete').onclick = () => {
            this.closeAllModals();
        };
    }

    copySongToClipboard(song) {
        const text = `${song.title}\n${song.artist}\nТональность: ${song.key}\n\n${song.lyrics}`;
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Текст скопирован в буфер', 'success');
        });
    }

    shareSong(song) {
        if (this.tg.isVersionAtLeast('6.1')) {
            this.tg.shareMessage({
                text: `${song.title}\n${song.artist}\nТональность: ${song.key}\n\n${song.lyrics.substring(0, 200)}...`
            });
        } else {
            this.copySongToClipboard(song);
            this.showToast('Скопировано в буфер, теперь можно поделиться', 'info');
        }
    }

    toggleFavorite(songId) {
        const index = this.favorites.indexOf(songId);
        if (index === -1) {
            this.favorites.push(songId);
        } else {
            this.favorites.splice(index, 1);
        }
        
        localStorage.setItem('worship_favorites', JSON.stringify(this.favorites));
        this.renderSongs();
        this.showToast(
            index === -1 ? 'Добавлено в избранное' : 'Удалено из избранного', 
            'success'
        );
    }

    showQuickTranspose(song) {
        // Быстрое транспонирование через попап
        const modal = document.createElement('div');
        modal.className = 'modal glass-card';
        modal.innerHTML = `
            <div class="modal-header">
                <h3>Быстрое транспонирование "${song.title}"</h3>
                <button class="icon-btn close-quick-transpose">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="transpose-presets">
                    ${this.chordTheory.keys.map(key => `
                        <div class="transpose-preset ${key === song.key ? 'active' : ''}" 
                             data-key="${key}">
                            ${key}
                        </div>
                    `).join('')}
                </div>
                <div class="transposed-preview" style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 10px; max-height: 300px; overflow-y: auto;">
                    ${this.formatLyricsWithChords(this.transposeSongLyrics(song.lyrics, song.key, song.key))}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Обработчики
        modal.querySelector('.close-quick-transpose').onclick = () => modal.remove();
        modal.querySelectorAll('.transpose-preset').forEach(btn => {
            btn.onclick = () => {
                const newKey = btn.dataset.key;
                const transposed = this.transposeSongLyrics(song.lyrics, song.key, newKey);
                modal.querySelector('.transposed-preview').innerHTML = 
                    this.formatLyricsWithChords(transposed);
                
                // Обновляем активную кнопку
                modal.querySelectorAll('.transpose-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });
    }

    formatLyricsWithChords(lyrics) {
        // Преобразуем текст с аккордами в красивый HTML
        const lines = lyrics.split('\n');
        return lines.map(line => {
            if (line.trim() === '') return '<br>';
            
            // Проверяем, есть ли в строке аккорды
            const hasChords = line.includes('[');
            
            if (hasChords) {
                // Разделяем аккорды и текст
                const parts = line.split(/(\[[^\]]+\])/);
                return parts.map(part => {
                    if (part.startsWith('[') && part.endsWith(']')) {
                        const chord = part.slice(1, -1);
                        return `<span class="chord-inline">${chord}</span>`;
                    }
                    return `<span>${part}</span>`;
                }).join('');
            }
            
            return `<div class="lyrics-line">${line}</div>`;
        }).join('');
    }

    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    getGradientForSong(id) {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        ];
        return gradients[id % gradients.length];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    handleOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        const indicator = document.querySelector('.sync-indicator');
        
        if (isOnline) {
            indicator.innerHTML = '<i class="fas fa-wifi"></i> Онлайн';
            indicator.className = 'sync-indicator syncing';
            // Пытаемся синхронизировать ожидающие изменения
            this.syncPendingChanges();
        } else {
            indicator.innerHTML = '<i class="fas fa-wifi-slash"></i> Офлайн';
            indicator.className = 'sync-indicator error';
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WorshipSongsApp();
    
    // Добавляем индикатор синхронизации в DOM
    const syncIndicator = document.createElement('div');
    syncIndicator.id = 'sync-indicator';
    syncIndicator.className = 'sync-indicator syncing';
    syncIndicator.innerHTML = '<i class="fas fa-sync fa-spin"></i> Синхронизация...';
    document.body.appendChild(syncIndicator);
});
