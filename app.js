class WorshipSongsApp {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.songs = [];
        this.playlists = [];
        this.currentSong = null;
        this.currentPage = 'songs';
        this.transposeSemitones = 0;
        
        this.chordMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        this.chordNames = [
            'C', 'C#', 'D', 'D#', 'E', 'F', 
            'F#', 'G', 'G#', 'A', 'A#', 'B'
        ];
        
        this.init();
    }

    async init() {
        // Инициализация Telegram
        this.tg.expand();
        this.tg.enableClosingConfirmation();
        
        // Загрузка данных
        await this.loadData();
        
        // Инициализация интерфейса
        this.initUI();
        this.initEvents();
        
        // Показ основного интерфейса после загрузки
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            this.showToast('Приложение загружено!', 'success');
        }, 2000);
    }

    async loadData() {
        try {
            // Загрузка из localStorage или создание демо-данных
            const savedSongs = localStorage.getItem('worship_songs');
            const savedPlaylists = localStorage.getItem('worship_playlists');
            
            if (savedSongs) {
                this.songs = JSON.parse(savedSongs);
            } else {
                // Демо-данные
                this.songs = [
                    {
                        id: 1,
                        title: 'Великий Бог',
                        artist: 'Hillsong на русском',
                        key: 'G',
                        category: 'worship',
                        lyrics: `[G]Великий Бог, спаситель мой\n[C]Хочу вос-петь Тебе хва-[G]лу\n[D]Великий Бог, Ты святой\n[Em]Ты достоин всей хва-[C]лы`,
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 2,
                        title: 'Река жизни',
                        artist: 'Максим Гавриленко',
                        key: 'C',
                        category: 'praise',
                        lyrics: `[C]Река жизни течет от пре-[G]стола\n[Am]Очищает, исцеляет [F]меня\n[C]Я хочу пить живую во-[G]ду\n[Am]И купаться в реке до [F]дна`,
                        createdAt: new Date().toISOString()
                    }
                ];
            }
            
            if (savedPlaylists) {
                this.playlists = JSON.parse(savedPlaylists);
            } else {
                this.playlists = [
                    {
                        id: 1,
                        name: 'Воскресное служение',
                        description: 'Песни для воскресного богослужения',
                        songs: [1, 2],
                        createdAt: new Date().toISOString()
                    }
                ];
            }
            
            this.updateCounters();
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showToast('Ошибка загрузки данных', 'error');
        }
    }

    saveData() {
        localStorage.setItem('worship_songs', JSON.stringify(this.songs));
        localStorage.setItem('worship_playlists', JSON.stringify(this.playlists));
    }

    initUI() {
        // Показ имени пользователя Telegram
        const user = this.tg.initDataUnsafe.user;
        if (user) {
            document.getElementById('user-name').textContent = 
                user.first_name || 'Участник команды';
        }
        
        // Отображение списка песен
        this.renderSongs();
        this.renderPlaylists();
        
        // Заполнение опций транспонирования
        this.initTransposeOptions();
    }

    initEvents() {
        // Навигация
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                if (page) this.switchPage(page);
            });
        });

        // Кнопка добавления песни
        document.getElementById('add-song-btn').addEventListener('click', () => {
            this.showAddSongModal();
        });

        // Поиск
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterSongs(e.target.value);
        });

        // Фильтры
        document.getElementById('filter-btn').addEventListener('click', () => {
            const options = document.getElementById('filter-options');
            options.classList.toggle('hidden');
        });

        // Модальные окна
        document.querySelectorAll('.close-modal, .modal-overlay, .back-to-list').forEach(el => {
            el.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // Сохранение песни
        document.getElementById('save-song-btn').addEventListener('click', () => {
            this.saveNewSong();
        });

        // Транспонирование
        document.getElementById('transpose-up').addEventListener('click', () => {
            this.transposeSong(1);
        });

        document.getElementById('transpose-down').addEventListener('click', () => {
            this.transposeSong(-1);
        });

        document.getElementById('transpose-select').addEventListener('change', (e) => {
            this.transposeToKey(e.target.value);
        });

        // Аудиоплеер
        document.querySelectorAll('.player-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.audio;
                this.switchAudio(type);
            });
        });

        // Создание плейлиста
        document.getElementById('create-playlist-btn').addEventListener('click', () => {
            this.showCreatePlaylistModal();
        });
    }

    renderSongs(filteredSongs = null) {
        const songsList = document.getElementById('songs-list');
        const songsToShow = filteredSongs || this.songs;
        
        songsList.innerHTML = '';
        
        songsToShow.forEach(song => {
            const songEl = document.createElement('div');
            songEl.className = 'song-item glass-card';
            songEl.innerHTML = `
                <div class="song-cover">
                    <i class="fas fa-music"></i>
                </div>
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                    <div class="song-meta">
                        <span class="key-badge">${song.key}</span>
                        <span>${this.getCategoryName(song.category)}</span>
                    </div>
                </div>
                <i class="fas fa-chevron-right"></i>
            `;
            
            songEl.addEventListener('click', () => {
                this.showSongModal(song);
            });
            
            songsList.appendChild(songEl);
        });
        
        document.getElementById('songs-count').textContent = songsToShow.length;
    }

    renderPlaylists() {
        const playlistsList = document.getElementById('playlists-list');
        playlistsList.innerHTML = '';
        
        this.playlists.forEach(playlist => {
            const playlistEl = document.createElement('div');
            playlistEl.className = 'playlist-card glass-card';
            playlistEl.innerHTML = `
                <div class="playlist-icon">
                    <i class="fas fa-list-music"></i>
                </div>
                <div class="playlist-count">${playlist.songs.length}</div>
                <h4>${playlist.name}</h4>
                <p class="song-artist">${playlist.description || ''}</p>
            `;
            
            playlistEl.addEventListener('click', () => {
                this.showPlaylistSongs(playlist);
            });
            
            playlistsList.appendChild(playlistEl);
        });
    }

    showSongModal(song) {
        this.currentSong = song;
        this.transposeSemitones = 0;
        
        // Заполнение данных
        document.getElementById('modal-song-title').textContent = song.title;
        document.getElementById('modal-song-artist').textContent = song.artist;
        document.getElementById('modal-song-key').textContent = song.key;
        document.getElementById('current-key').textContent = song.key;
        
        // Отображение текста
        this.displayLyrics(song.lyrics);
        
        // Обновление опций транспонирования
        document.getElementById('transpose-select').value = song.key;
        
        // Показать модалку
        document.getElementById('song-modal').classList.remove('hidden');
        document.getElementById('modal-overlay').classList.remove('hidden');
        
        // Инициализация аудио
        if (song.audioOriginal) {
            this.loadAudio(song.audioOriginal, 'original');
        }
    }

    displayLyrics(lyrics) {
        const container = document.getElementById('song-lyrics-content');
        const transposedContainer = document.getElementById('transposed-lyrics');
        
        // Простой парсинг аккордов [C], [G], etc
        const htmlLyrics = lyrics.replace(/\[([^\]]+)\]/g, 
            '<span class="chord">[$1]</span>');
        
        container.innerHTML = htmlLyrics;
        transposedContainer.innerHTML = htmlLyrics;
    }

    transposeSong(semitones) {
        this.transposeSemitones += semitones;
        
        // Обновление текущей тональности
        const originalKeyIndex = this.chordMap[this.currentSong.key];
        const newKeyIndex = (originalKeyIndex + this.transposeSemitones + 12) % 12;
        const newKey = this.chordNames[newKeyIndex];
        
        document.getElementById('current-key').textContent = newKey;
        document.getElementById('transpose-select').value = newKey;
        
        // Транспонирование текста
        this.transposeLyrics();
    }

    transposeLyrics() {
        const lyrics = this.currentSong.lyrics;
        const transposedContainer = document.getElementById('transposed-lyrics');
        
        // Простой транспонирование аккордов
        const transposedLyrics = lyrics.replace(/\[([^\]]+)\]/g, (match, chord) => {
            if (this.chordMap[chord] !== undefined) {
                const newIndex = (this.chordMap[chord] + this.transposeSemitones + 12) % 12;
                return `[${this.chordNames[newIndex]}]`;
            }
            return match;
        });
        
        const htmlLyrics = transposedLyrics.replace(/\[([^\]]+)\]/g, 
            '<span class="chord">[$1]</span>');
        
        transposedContainer.innerHTML = htmlLyrics;
    }

    transposeToKey(targetKey) {
        const originalKeyIndex = this.chordMap[this.currentSong.key];
        const targetKeyIndex = this.chordMap[targetKey];
        
        this.transposeSemitones = targetKeyIndex - originalKeyIndex;
        this.transposeLyrics();
        document.getElementById('current-key').textContent = targetKey;
    }

    initTransposeOptions() {
        const select = document.getElementById('transpose-select');
        select.innerHTML = '';
        
        this.chordNames.forEach(chord => {
            const option = document.createElement('option');
            option.value = chord;
            option.textContent = chord;
            select.appendChild(option);
        });
    }

    showAddSongModal() {
        document.getElementById('add-song-modal').classList.remove('hidden');
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    async saveNewSong() {
        const title = document.getElementById('song-title').value.trim();
        const artist = document.getElementById('song-artist').value.trim();
        const key = document.getElementById('song-key').value;
        const category = document.getElementById('song-category').value;
        const lyrics = document.getElementById('song-lyrics').value.trim();
        
        if (!title || !key || !lyrics) {
            this.showToast('Заполните обязательные поля', 'error');
            return;
        }
        
        const newSong = {
            id: Date.now(),
            title,
            artist: artist || 'Неизвестен',
            key,
            category,
            lyrics,
            createdAt: new Date().toISOString(),
            audioOriginal: null,
            audioPlayback: null
        };
        
        // Обработка аудиофайлов
        const originalFile = document.getElementById('original-audio').files[0];
        const playbackFile = document.getElementById('playback-audio').files[0];
        
        if (originalFile) {
            newSong.audioOriginal = await this.convertFileToBase64(originalFile);
        }
        
        if (playbackFile) {
            newSong.audioPlayback = await this.convertFileToBase64(playbackFile);
        }
        
        this.songs.push(newSong);
        this.saveData();
        this.renderSongs();
        this.updateCounters();
        
        this.closeAllModals();
        this.showToast('Песня сохранена!', 'success');
        
        // Очистка формы
        document.getElementById('add-song-modal').querySelectorAll('input, textarea, select').forEach(el => {
            if (el.type !== 'file') el.value = '';
        });
    }

    async convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    filterSongs(searchTerm) {
        const keyFilter = document.getElementById('key-filter').value;
        const categoryFilter = document.getElementById('category-filter').value;
        
        let filtered = this.songs;
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(song => 
                song.title.toLowerCase().includes(term) ||
                song.artist.toLowerCase().includes(term)
            );
        }
        
        if (keyFilter) {
            filtered = filtered.filter(song => song.key === keyFilter);
        }
        
        if (categoryFilter) {
            filtered = filtered.filter(song => song.category === categoryFilter);
        }
        
        this.renderSongs(filtered);
    }

    switchPage(page) {
        this.currentPage = page;
        
        // Обновление активной кнопки навигации
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        
        // Скрыть все секции
        document.getElementById('songs-section')?.classList.add('hidden');
        document.getElementById('playlists-section')?.classList.add('hidden');
        document.getElementById('profile-section')?.classList.add('hidden');
        
        // Показать нужную секцию
        const sectionMap = {
            'songs': document.querySelector('.songs-container').parentElement,
            'playlists': document.getElementById('playlists-section'),
            'profile': document.getElementById('profile-section')
        };
        
        if (sectionMap[page]) {
            sectionMap[page].classList.remove('hidden');
        }
    }

    updateCounters() {
        document.getElementById('stats-songs').textContent = this.songs.length;
        document.getElementById('stats-playlists').textContent = this.playlists.length;
        document.getElementById('stats-transposed').textContent = 
            this.songs.filter(s => s.transpositions).length || 0;
    }

    getCategoryName(category) {
        const categories = {
            'praise': 'Хвала',
            'worship': 'Поклонение',
            'fast': 'Быстрые',
            'slow': 'Медленные'
        };
        return categories[category] || category;
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showCreatePlaylistModal() {
        const selector = document.getElementById('playlist-songs-selector');
        selector.innerHTML = '';
        
        this.songs.forEach(song => {
            const checkbox = document.createElement('div');
            checkbox.className = 'playlist-song-option';
            checkbox.innerHTML = `
                <input type="checkbox" id="song-${song.id}" value="${song.id}">
                <label for="song-${song.id}">
                    ${song.title} - ${song.artist} (${song.key})
                </label>
            `;
            selector.appendChild(checkbox);
        });
        
        document.getElementById('create-playlist-modal').classList.remove('hidden');
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    savePlaylist() {
        const name = document.getElementById('playlist-name').value.trim();
        const description = document.getElementById('playlist-description').value.trim();
        
        if (!name) {
            this.showToast('Введите название плейлиста', 'error');
            return;
        }
        
        const selectedSongs = [];
        document.querySelectorAll('#playlist-songs-selector input:checked').forEach(cb => {
            selectedSongs.push(parseInt(cb.value));
        });
        
        const newPlaylist = {
            id: Date.now(),
            name,
            description,
            songs: selectedSongs,
            createdAt: new Date().toISOString()
        };
        
        this.playlists.push(newPlaylist);
        this.saveData();
        this.renderPlaylists();
        
        this.closeAllModals();
        this.showToast('Плейлист создан!', 'success');
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WorshipSongsApp();
    
    // Обработчик сохранения плейлиста
    document.getElementById('save-playlist-btn').addEventListener('click', () => {
        window.app.savePlaylist();
    });
});