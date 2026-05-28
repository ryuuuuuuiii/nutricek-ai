const fileInput    = document.getElementById('file-input');
const dropZone     = document.getElementById('drop-zone');
const imgPreview   = document.getElementById('img-preview');
const dropHolder   = document.getElementById('drop-placeholder');
const fileInfo     = document.getElementById('file-info');
const btnAnalisis  = document.getElementById('btn-analisis');
const btnText      = document.getElementById('btn-text');
const spinner      = document.getElementById('spinner');
const errorBanner  = document.getElementById('error-banner');
const hasilSection = document.getElementById('hasil-section');

let selectedFile = null;

// ── Drag & Drop ─────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f?.type.startsWith('image/')) handleFile(f);
  else showError('⚠ File harus berupa gambar (JPG, PNG, WEBP).');
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

// ── Handle file ──────────────────────────────────────────────────────────────
function handleFile(file) {
  selectedFile = file;
  hideError();
  resetHasil();

  const reader = new FileReader();
  reader.onload = e => {
    imgPreview.src = e.target.result;
    imgPreview.classList.add('show');
    dropHolder.style.display = 'none';
    dropZone.classList.add('has-image');
  };
  reader.readAsDataURL(file);

  fileInfo.textContent = `✓ ${file.name}  (${(file.size/1024).toFixed(1)} KB)`;
  fileInfo.style.display = 'block';

  btnAnalisis.disabled = false;
  btnText.textContent = 'SCAN NUTRISI';
}

// ── Analisis ─────────────────────────────────────────────────────────────────
btnAnalisis.addEventListener('click', async () => {
  if (!selectedFile) return;
  setLoading(true);
  hideError();
  resetHasil();

  const form = new FormData();
  form.append('file', selectedFile);

  try {
    const res = await fetch('/api/analisis', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.detail?.message || data?.detail || data?.error || 'Terjadi kesalahan server.';
      showError('⚠ ' + msg);
      return;
    }
    if (data.error) { showError('⚠ ' + data.error); return; }

    renderHasil(data);
  } catch (err) {
    console.error(err);
    showError('⚠ Tidak dapat terhubung ke server. Pastikan backend berjalan.');
  } finally {
    setLoading(false);
  }
});

// ── Render hasil ─────────────────────────────────────────────────────────────
function renderHasil(d) {
  document.getElementById('hasil-nama').textContent  = d.nama_makanan   ?? '—';
  document.getElementById('hasil-porsi').textContent = d.porsi_estimasi ?? '';
  document.getElementById('hasil-kalori').textContent = d.kalori ?? '?';

  const n = d.nutrisi ?? {};
  document.getElementById('n-karbo').textContent   = n.karbohidrat_g ?? '?';
  document.getElementById('n-protein').textContent = n.protein_g     ?? '?';
  document.getElementById('n-lemak').textContent   = n.lemak_g       ?? '?';
  document.getElementById('n-serat').textContent   = n.serat_g       ?? '?';

  document.getElementById('hasil-catatan').textContent = d.catatan ?? '—';

  // Alergen
  const box = document.getElementById('alergen-list');
  box.innerHTML = '';
  const list = d.alergen_potensial ?? [];
  if (!list.length) {
    box.innerHTML = '<span style="font-family:IBM Plex Mono,monospace;font-size:.72rem;color:var(--text-dim)">tidak terdeteksi</span>';
  } else {
    list.forEach(a => {
      const b = document.createElement('span');
      b.className = 'alergen-badge';
      b.textContent = a;
      box.appendChild(b);
    });
  }

  // Score ring
  const skor = Math.min(10, Math.max(0, d.skor_kesehatan ?? 0));
  document.getElementById('score-num').textContent = skor;
  const ring = document.getElementById('score-ring');
  const circ = 2 * Math.PI * 34;
  const offset = circ - (skor / 10) * circ;
  ring.style.stroke = skor >= 7 ? '#39ff14' : skor >= 4 ? '#ffb700' : '#ff3860';
  setTimeout(() => { ring.style.strokeDashoffset = offset; }, 80);

  // Show
  hasilSection.style.display = 'flex';
  requestAnimationFrame(() => hasilSection.classList.add('visible'));
  hasilSection.scrollIntoView({ behavior: 'smooth' });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function setLoading(on) {
  btnAnalisis.disabled = on;
  spinner.style.display = on ? 'block' : 'none';
  btnText.textContent = on ? 'SCANNING...' : 'SCAN NUTRISI';
}
function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.style.display = 'block';
}
function hideError() {
  errorBanner.style.display = 'none';
}
function resetHasil() {
  hasilSection.style.display = 'none';
  hasilSection.classList.remove('visible');
  document.getElementById('score-ring').style.strokeDashoffset = 2 * Math.PI * 34;
}