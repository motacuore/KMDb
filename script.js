let totalMovies = 0;
let downloadedMoviesTmdb = 0;
let downloadedMoviesOmdb = 0;
let totalSizeBytes = 0;
let notFoundMovies = [];
let remainingMovies = [];
let isPaused = false;
let isStopped = false;
let excelData = [];
let notFoundExcelData = [];
let savedImages = []; // لتخزين الصور المحفوظة
let savedData = []; // لتخزين البيانات المحفوظة
let currentSearchSource = ''; // لتتبع مصدر البحث الحالي
let savedImagesCount = 0; // عدد الصور المحفوظة
let uploadedFileName = ''; // اسم الملف الذي تم رفعه

// مفاتيح API الافتراضية
let tmdbApiKey = '9dcf6f3bef9f1770fec12db5cda42d6d'; // TMDb API Key
let omdbApiKey = 'f4e09aec'; // OMDb API Key

// عناصر واجهة المستخدم
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const startTmdbButton = document.getElementById('startTmdbButton');
const startOmdbButton = document.getElementById('startOmdbButton');
const startBothButton = document.getElementById('startBothButton');
const fetchDataButton = document.getElementById('fetchDataButton');
const pauseButton = document.getElementById('pauseButton');
const stopButton = document.getElementById('stopButton');
const resetButton = document.getElementById('resetButton');
const downloadExcelCheckbox = document.getElementById('downloadExcelCheckbox');
const tmdbApiKeyInput = document.getElementById('tmdbApiKeyInput');
const omdbApiKeyInput = document.getElementById('omdbApiKeyInput');
const totalMoviesSpan = document.getElementById('totalMovies');
const remainingSpan = document.getElementById('remaining');
const downloadedTmdbSpan = document.getElementById('downloadedTmdb');
const downloadedOmdbSpan = document.getElementById('downloadedOmdb');
const sizeSpan = document.getElementById('size');
const searchInput = document.getElementById('searchInput');
const searchTmdbButton = document.getElementById('searchTmdbButton');
const searchOmdbButton = document.getElementById('searchOmdbButton');
const movieDetails = document.getElementById('movieDetails');
const saveCurrentButton = document.getElementById('saveCurrentButton');
const downloadAllButton = document.getElementById('downloadAllButton');
const savedImagesCounter = document.getElementById('savedImagesCounter');

// أحداث الأزرار
uploadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
startTmdbButton.addEventListener('click', () => processMovies('tmdb'));
startOmdbButton.addEventListener('click', () => processMovies('omdb'));
startBothButton.addEventListener('click', () => processMovies('both'));
fetchDataButton.addEventListener('click', () => processMovies('fetch'));
pauseButton.addEventListener('click', () => isPaused = true);
stopButton.addEventListener('click', stopProcess);
resetButton.addEventListener('click', resetApp);
searchTmdbButton.addEventListener('click', () => searchAndDisplayMovie('tmdb'));
searchOmdbButton.addEventListener('click', () => searchAndDisplayMovie('omdb'));
saveCurrentButton.addEventListener('click', saveCurrent);
downloadAllButton.addEventListener('click', downloadAll);

// معالجة تحميل الملف
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        uploadedFileName = file.name.replace(/\.[^/.]+$/, ""); // استخراج اسم الملف بدون الامتداد
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const movies = content.split('\n').filter(line => line.trim() !== '');
            remainingMovies = movies;
            totalMovies = movies.length;
            totalMoviesSpan.textContent = totalMovies;
            remainingSpan.textContent = remainingMovies.length;
            downloadedMoviesTmdb = 0;
            downloadedMoviesOmdb = 0;
            totalSizeBytes = 0;
            notFoundMovies = [];
            excelData = [];
            notFoundExcelData = [];
            updateCounters();
            updateProgress();
            startTmdbButton.disabled = false;
            startOmdbButton.disabled = false;
            startBothButton.disabled = false;
            fetchDataButton.disabled = false;
            pauseButton.disabled = false;
            stopButton.disabled = false;
        };
        reader.readAsText(file);
    }
}

// معالجة الأفلام
async function processMovies(apiType) {
    // تحديث مفاتيح API إذا تم إدخالها
    tmdbApiKey = tmdbApiKeyInput.value.trim() || tmdbApiKey;
    omdbApiKey = omdbApiKeyInput.value.trim() || omdbApiKey;

    while (remainingMovies.length > 0 && !isStopped) {
        if (isPaused) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
        }

        const movie = remainingMovies.shift();
        const [title, year] = movie.split(',').map(item => item.trim());

        let foundInTmdb = false;
        let foundInOmdb = false;

        if (apiType === 'fetch') {
            foundInTmdb = await searchMovie(title, year, 'tmdb', true);
            foundInOmdb = await searchMovie(title, year, 'omdb', true);
        } else if (apiType === 'tmdb') {
            foundInTmdb = await searchMovie(title, year, 'tmdb', false);
        } else if (apiType === 'omdb') {
            foundInOmdb = await searchMovie(title, year, 'omdb', false);
        } else if (apiType === 'both') {
            foundInTmdb = await searchMovie(title, year, 'tmdb', false, true);
            foundInOmdb = await searchMovie(title, year, 'omdb', false, true);
        }

        if (!foundInTmdb && !foundInOmdb) {
            notFoundMovies.push(`${title},${year}`);
            notFoundExcelData.push({ searchedTitle: title, year: year || 'N/A' });
        }

        remainingSpan.textContent = remainingMovies.length;
        updateCounters();
        updateProgress();
        await new Promise(resolve => setTimeout(resolve, apiType === 'fetch' ? 200 : 500));
    }

    if (isStopped) {
        alert('Process stopped permanently.');
    } else if (remainingMovies.length === 0) {
        alert('Process completed!');
        if (downloadExcelCheckbox.checked || apiType === 'fetch') {
            const excelFileName = `${uploadedFileName}_${apiType}.xlsx`; // اسم الملف بناءً على اسم الملف المرفوع ونوع العملية
            createExcelFile(excelData, excelFileName);
            createExcelFile(notFoundExcelData, `${uploadedFileName}_not_found.xlsx`);
        }
    }
}

// البحث عن الفيلم
async function searchMovie(title, year, apiType, fetchOnly = false, isBothMode = false) {
    try {
        let response, posterUrl;
        let foundInApi = false;

        if (apiType === 'tmdb') {
            response = await $.ajax({
                url: `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}&year=${year || ''}`,
                type: 'GET',
            });

            if (response.results && response.results.length > 0) {
                foundInApi = true;
                const movieId = response.results[0].id;
                const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`;

                const detailsResponse = await fetch(detailsUrl);
                const detailsData = await detailsResponse.json();

                // جمع التصنيفات
                const mainGenre = detailsData.genres && detailsData.genres.length > 0 ? detailsData.genres[0].name : 'N/A';
                const secondaryGenre = detailsData.genres && detailsData.genres.length > 1 ? detailsData.genres[1].name : 'N/A';
                const allGenres = detailsData.genres ? detailsData.genres.map(genre => genre.name).join(', ') : 'N/A';

                const imagesUrl = `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${tmdbApiKey}`;
                const imagesResponse = await fetch(imagesUrl);
                const imagesData = await imagesResponse.json();

                if (imagesData.posters && imagesData.posters.length > 0) {
                    posterUrl = `https://image.tmdb.org/t/p/original${imagesData.posters[0].file_path}`;

                    if (!fetchOnly) {
                        const filename = isBothMode ? `${title} ${year || ''} (TMDB).jpg` : `${title} ${year || ''}.jpg`;
                        await downloadImage(posterUrl, filename, 'TMDb');
                    }
                }

                excelData.push({
                    searchedTitle: title,
                    imdbTitle: detailsData.title,
                    year: detailsData.release_date ? detailsData.release_date.split('-')[0] : 'N/A',
                    rating: detailsData.vote_average || 'N/A',
                    overview: detailsData.overview || 'No description.',
                    mainGenre: mainGenre, // التصنيف الرئيسي
                    secondaryGenre: secondaryGenre, // التصنيف الثانوي
                    allGenres: allGenres, // جميع التصنيفات
                    actors: detailsData.credits ? detailsData.credits.cast.slice(0, 5).map(actor => actor.name).join(', ') : 'N/A',
                    director: detailsData.credits ? detailsData.credits.crew.find(member => member.job === 'Director')?.name : 'N/A',
                    posterUrl: posterUrl || 'N/A',
                    source: 'TMDb'
                });

                downloadedMoviesTmdb++;
                downloadedTmdbSpan.textContent = downloadedMoviesTmdb;
            }
        } else if (apiType === 'omdb') {
            response = await fetch(`https://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(title)}&y=${year || ''}`);
            const data = await response.json();

            if (data.Response === 'True') {
                foundInApi = true;
                const genres = data.Genre || 'N/A';
                const mainGenre = genres ? genres.split(',')[0].trim() : 'N/A';
                const secondaryGenre = genres ? genres.split(',')[1].trim() : 'N/A';

                let posterUrl = data.Poster;
                if (posterUrl && posterUrl !== 'N/A') {
                    posterUrl = posterUrl.replace(/\._V1_SX\d+\./, '._V1.'); // إزالة التحجيم من الرابط

                    if (!fetchOnly) {
                        const filename = isBothMode ? `${title} ${year || ''} (OMDB).jpg` : `${title} ${year || ''}.jpg`;
                        await downloadImage(posterUrl, filename, 'OMDb');
                    }
                }

                excelData.push({
                    searchedTitle: title,
                    imdbTitle: data.Title,
                    year: data.Year || 'N/A',
                    rating: data.imdbRating || 'N/A',
                    overview: data.Plot || 'No description.',
                    mainGenre: mainGenre, // التصنيف الرئيسي
                    secondaryGenre: secondaryGenre, // التصنيف الثانوي
                    allGenres: genres, // جميع التصنيفات
                    actors: data.Actors || 'N/A',
                    director: data.Director || 'N/A',
                    posterUrl: posterUrl || 'N/A',
                    source: 'OMDb'
                });

                downloadedMoviesOmdb++;
                downloadedOmdbSpan.textContent = downloadedMoviesOmdb;
            }
        }

        return foundInApi;
    } catch (error) {
        console.error(`Error searching for ${title} (${year}):`, error);
        return false;
    }
}

// تنزيل الصورة
async function downloadImage(url, filename, source) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        saveAs(blob, filename);

        totalSizeBytes += blob.size;
        updateCounters();
    } catch (error) {
        console.error('Error downloading image:', error);
    }
}

// إيقاف العملية
function stopProcess() {
    isStopped = true;
    if (downloadExcelCheckbox.checked) {
        createExcelFile(excelData, `${uploadedFileName}_movies.xlsx`);
        createExcelFile(notFoundExcelData, `${uploadedFileName}_not_found.xlsx`);
    }
    alert('Process stopped. Data saved.');
}

// إعادة تعيين التطبيق
function resetApp() {
    totalMovies = 0;
    downloadedMoviesTmdb = 0;
    downloadedMoviesOmdb = 0;
    totalSizeBytes = 0;
    notFoundMovies = [];
    remainingMovies = [];
    isPaused = false;
    isStopped = false;
    excelData = [];
    notFoundExcelData = [];
    savedImages = [];
    savedData = [];
    savedImagesCount = 0; // إعادة تعيين العداد
    fileInput.value = '';
    totalMoviesSpan.textContent = 0;
    remainingSpan.textContent = 0;
    downloadedTmdbSpan.textContent = 0;
    downloadedOmdbSpan.textContent = 0;
    sizeSpan.textContent = '0 MB / 0 GB';
    updateSavedImagesCounter(); // تحديث العداد
    updateProgress(); // إعادة تعيين شريط التقدم
    startTmdbButton.disabled = true;
    startOmdbButton.disabled = true;
    startBothButton.disabled = true;
    fetchDataButton.disabled = true;
    pauseButton.disabled = true;
    stopButton.disabled = true;
    saveCurrentButton.disabled = true;
    downloadAllButton.disabled = true;
}

// تحديث العدادات
function updateCounters() {
    const sizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    const sizeGB = (totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2);
    sizeSpan.textContent = `${sizeMB} MB / ${sizeGB} GB`;
}

// تحديث شريط التقدم
function updateProgress() {
    const progress = ((totalMovies - remainingMovies.length) / totalMovies) * 100 || 0; // التأكد من عدم وجود NaN
    document.getElementById('progress').style.width = `${progress}%`;
}

// إنشاء ملف Excel
function createExcelFile(data, filename) {
    if (!data || data.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movies");

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    saveAs(blob, filename);
}

// تحويل النص إلى ArrayBuffer
function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
}

// البحث وعرض بيانات الفيلم
async function searchAndDisplayMovie(apiType) {
    const query = searchInput.value.trim();
    if (!query) {
        alert('Please enter a movie title.');
        return;
    }

    const [title, year] = query.split(',').map(item => item.trim());

    // تحديث مفاتيح API إذا تم إدخالها
    tmdbApiKey = tmdbApiKeyInput.value.trim() || tmdbApiKey;
    omdbApiKey = omdbApiKeyInput.value.trim() || omdbApiKey;

    try {
        let response, detailsData, posterUrl, genres;

        // تحديث مصدر البحث الحالي
        currentSearchSource = apiType === 'tmdb' ? 'TMDb' : 'OMDb';

        if (apiType === 'tmdb') {
            response = await $.ajax({
                url: `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}&year=${year || ''}`,
                type: 'GET',
            });

            if (response.results && response.results.length > 0) {
                const movieId = response.results[0].id;
                const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`;

                const detailsResponse = await fetch(detailsUrl);
                detailsData = await detailsResponse.json();

                const imagesUrl = `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${tmdbApiKey}`;
                const imagesResponse = await fetch(imagesUrl);
                const imagesData = await imagesResponse.json();

                posterUrl = imagesData.posters && imagesData.posters.length > 0
                    ? `https://image.tmdb.org/t/p/original${imagesData.posters[0].file_path}`
                    : 'N/A';

                genres = detailsData.genres ? detailsData.genres.map(genre => genre.name).join(', ') : 'N/A';
            } else {
                movieDetails.innerHTML = `<p>No results found for "${title}" on TMDb.</p>`;
                return;
            }
        } else if (apiType === 'omdb') {
            response = await fetch(`https://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(title)}&y=${year || ''}`);
            detailsData = await response.json();

            if (detailsData.Response === 'True') {
                posterUrl = detailsData.Poster !== 'N/A' ? detailsData.Poster.replace(/\._V1_SX\d+\./, '._V1.') : 'N/A'; // إزالة التحجيم من الرابط
                genres = detailsData.Genre || 'N/A';
            } else {
                movieDetails.innerHTML = `<p>No results found for "${title}" on OMDb.</p>`;
                return;
            }
        }

        // عرض بيانات الفيلم
        movieDetails.innerHTML = `
            <h2>${detailsData.Title || detailsData.title} (${detailsData.Year || (detailsData.release_date ? detailsData.release_date.split('-')[0] : 'N/A')})</h2>
            ${posterUrl !== 'N/A' ? `<img src="${posterUrl}" alt="${detailsData.Title || detailsData.title} Poster">` : ''}
            <p><strong>Rating:</strong> ${detailsData.imdbRating || detailsData.vote_average || 'N/A'}</p>
            <p><strong>Overview:</strong> ${detailsData.Plot || detailsData.overview || 'No description.'}</p>
            <p><strong>Genres:</strong> ${genres}</p>
            <p><strong>Actors:</strong> ${detailsData.Actors || (detailsData.credits ? detailsData.credits.cast.slice(0, 5).map(actor => actor.name).join(', ') : 'N/A')}</p>
            <p><strong>Director:</strong> ${detailsData.Director || (detailsData.credits ? detailsData.credits.crew.find(member => member.job === 'Director')?.name : 'N/A')}</p>
        `;

        // تفعيل الزر "Save Current"
        saveCurrentButton.disabled = false;
        downloadAllButton.disabled = savedData.length > 0;
    } catch (error) {
        console.error('Error searching for movie:', error);
        movieDetails.innerHTML = `<p>Error searching for movie. Please try again.</p>`;
    }
}

// وظيفة لحفظ الصورة والبيانات الحالية
function saveCurrent() {
    const movieDetails = document.getElementById('movieDetails');
    const img = movieDetails.querySelector('img');
    const title = movieDetails.querySelector('h2').textContent;
    const rating = movieDetails.querySelector('p:nth-child(3)').textContent;
    const overview = movieDetails.querySelector('p:nth-child(4)').textContent;
    const genres = movieDetails.querySelector('p:nth-child(5)').textContent;
    const actors = movieDetails.querySelector('p:nth-child(6)').textContent;
    const director = movieDetails.querySelector('p:nth-child(7)').textContent;

    if (img && img.src !== 'N/A') {
        const source = currentSearchSource; // استخدام مصدر البحث الحالي
        const filename = `${title} ${source}.jpg`; // تمييز الصورة بالمصدر
        savedImages.push({ src: img.src, filename: filename });
        savedData.push({
            searchedTitle: title,
            imdbTitle: title,
            year: title.match(/\(\d{4}\)/)?.[0].replace(/[()]/g, '') || 'N/A', // استخراج السنة من العنوان
            rating: rating.replace('Rating: ', ''),
            overview: overview.replace('Overview: ', ''),
            mainGenre: genres.split(', ')[0] || 'N/A', // التصنيف الرئيسي
            secondaryGenre: genres.split(', ')[1] || 'N/A', // التصنيف الثانوي
            allGenres: genres.replace('Genres: ', ''),
            actors: actors.replace('Actors: ', ''),
            director: director.replace('Director: ', ''),
            posterUrl: img.src.replace(/\._V1_SX\d+\./, '._V1.'), // إزالة التحجيم من الرابط
            source: source // إضافة المصدر
        });

        // زيادة العداد وتحديث واجهة المستخدم
        savedImagesCount++;
        updateSavedImagesCounter();

        // تغيير نص الزر إلى "Saved" لمدة ثانيتين
        showSaveIndicator();

        // تفعيل زر "Download All"
        downloadAllButton.disabled = false;
    }
}

// وظيفة لتحديث عداد الصور المحفوظة
function updateSavedImagesCounter() {
    if (savedImagesCounter) {
        savedImagesCounter.textContent = `Saved Images: ${savedImagesCount}`;
    }
}

// وظيفة لإظهار مؤشر مرئي بأن الصورة تم حفظها
function showSaveIndicator() {
    const saveCurrentButton = document.getElementById('saveCurrentButton');
    saveCurrentButton.textContent = 'Saved'; // تغيير النص إلى "Saved"

    // إعادة النص إلى "Save Current" بعد ثانيتين
    setTimeout(() => {
        saveCurrentButton.textContent = 'Save Current';
    }, 2000);
}