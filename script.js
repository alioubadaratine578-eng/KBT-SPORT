// ============================================
// KBT SPORT - Firebase Configuration
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyDBXl3OI8BKJe6gANQmC5Q_Wy8eDBcmmlQ",
    authDomain: "kbt-sport.firebaseapp.com",
    projectId: "kbt-sport",
    storageBucket: "kbt-sport.firebasestorage.app",
    messagingSenderId: "685693613981",
    appId: "1:685693613981:web:213082bdee6d4e46fea174",
    databaseURL: "https://kbt-sport-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================================
// CONFIGURATION
// ============================================
const WAVE_LINK = "https://pay.wave.com/m/M_sn_BGrpfVLX6coi/c/sn/";
const OM_LINK = "tel:%23144%2339%23619506%23";
const ADMIN_PASSWORD_TERRAIN = "KBT2026";
const ADMIN_PASSWORD_FITNESS = "KBTFIT2026";
const VALIDATION_DELAY_MS = 30 * 60 * 1000;

const TELEGRAM_BOT_TOKEN = "8653735403:AAHujm8OSWpiYizyBgcKdI50uRAGZADNoD8";
const TELEGRAM_CHAT_ID = "-5394160556";

// ============================================
// CRÉNEAUX BLOQUÉS
// ============================================
const BLOCKED_SLOTS = [
    { date: '2026-09-05', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-09-12', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-09-19', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-09-26', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-10-03', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-10-10', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-10-17', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-10-24', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-11-07', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-11-14', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-11-21', start: '22:00', end: '23:00', reason: 'Location douanier' },
    { date: '2026-11-28', start: '22:00', end: '23:00', reason: 'Location douanier' }
];

// ============================================
// FORMULES FITNESS
// ============================================
const FORMULES_FITNESS = {
    abonnement_mensuel: {
        id: 'abonnement_mensuel',
        nom: 'Abonnement mensuel',
        inscription: 7500,
        mensualite: 5000,
        type: 'abonnement'
    },
    seance: {
        id: 'seance',
        nom: 'Séance à l\'unité',
        inscription: 2500,
        entree: 300,
        type: 'seance'
    }
};

// ============================================
// ÉTAT GLOBAL
// ============================================
let reservationsPayees = {};
let reservationsAdmin = [];
let avisList = [];
let selectedSlot = null;

let isAdminTerrain = false;
let isAdminFitness = false;

let pendingReservation = null;
let pendingFitnessInscription = null;
let pendingType = null;
let lienPaiementActuel = '';
let noteAvisActuelle = 5;

let formuleFitnessChoisie = null;
let abonnementsFitness = [];

// ============================================
// UTILITAIRES
// ============================================
function formaterHeure(h) {
    let num = h >= 24 ? h - 24 : h;
    return num < 10 ? `0${num}h` : `${num}h`;
}

function isSlotBlocked(dateStr, slotName) {
    const startTime = slotName.split(' - ')[0].replace('h', ':00');
    return BLOCKED_SLOTS.some(slot => slot.date === dateStr && slot.start === startTime);
}

function getBlockedReason(dateStr, slotName) {
    const startTime = slotName.split(' - ')[0].replace('h', ':00');
    const slot = BLOCKED_SLOTS.find(s => s.date === dateStr && s.start === startTime);
    return slot ? slot.reason : null;
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 4000);
}

function showLoader(text = "Traitement...") {
    const l = document.getElementById('loader');
    const t = document.getElementById('loader-text');
    if (l) { if (t) t.textContent = text; l.classList.remove('hidden'); }
}

function hideLoader() {
    const l = document.getElementById('loader');
    if (l) l.classList.add('hidden');
}

async function envoyerNotificationTelegram(reservation) {
    try {
        const message =
            `🔔 *NOUVELLE RÉSERVATION KBT SPORT*\n\n` +
            `👤 *Client :* ${reservation.name}\n` +
            `📞 *Téléphone :* ${reservation.phone}\n` +
            `📅 *Date :* ${reservation.date}\n` +
            `🕐 *Créneau :* ${reservation.slot}\n` +
            `⚽ *Match :* ${reservation.equipeA} vs ${reservation.equipeB}\n` +
            `💰 *Acompte :* ${new Intl.NumberFormat('fr-FR').format(reservation.acompte)} FCFA\n` +
            `💳 *Paiement :* ${reservation.paiement === 'wave' ? 'Wave 🌊' : 'Orange Money 🟠'}\n\n` +
            `✅ *À VALIDER dans l'admin !*`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' })
        });
    } catch (err) { console.error("❌ Erreur Telegram:", err); }
}

function getCreneauxPending(dateStr) {
    const now = Date.now();
    const pending = [];
    reservationsAdmin.forEach((r) => {
        if (r.date === dateStr && r.statut === 'a_verifier' && r.expire_at && r.expire_at > now) {
            r.slot.split(', ').forEach(s => pending.push(s.trim()));
        }
    });
    return pending;
}

// ============================================
// ÉCRAN DE CHOIX
// ============================================
window.chooseSection = function (section) {
    const choice = document.getElementById('choice-screen');
    if (!choice) return;
    choice.classList.add('hide');
    setTimeout(() => {
        choice.style.display = 'none';
        switchTab(section);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 600);
};

window.retourChoix = function () {
    const choice = document.getElementById('choice-screen');
    if (!choice) return;
    choice.style.display = 'flex';
    choice.classList.remove('hide');
};

// ============================================
// ONGLETS PRINCIPAUX
// ============================================
window.switchTab = function (tabName) {
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.main-tab[data-tab="${tabName}"]`);
    const content = document.getElementById(`tab-${tabName}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
};

// ============================================
// CALCUL DU PRIX
// ============================================
window.calculerPrix = () => {
    const tarifSelect = document.getElementById('tarif-select');
    const dureeSelect = document.getElementById('duree');
    const totalPrice = document.getElementById('total-price');
    const depositEl = document.getElementById('deposit-amount');
    if (!tarifSelect || !dureeSelect || !totalPrice) return;

    const total = parseInt(tarifSelect.value) * parseInt(dureeSelect.value);
    totalPrice.innerText = new Intl.NumberFormat('fr-FR').format(total) + " FCFA";
    if (depositEl) {
        const deposit = Math.round(total / 2);
        depositEl.innerText = new Intl.NumberFormat('fr-FR').format(deposit) + " FCFA";
    }
};

// ============================================
// AVIS CLIENTS
// ============================================
window.setNote = function(n) {
    noteAvisActuelle = n;
    document.querySelectorAll('#stars-container span').forEach((span, i) => {
        if (i < n) span.classList.add('active');
        else span.classList.remove('active');
    });
    document.getElementById('note-actuelle').textContent = `${n}/5`;
};

window.ouvrirModaleAvis = function() {
    document.getElementById('avis-modal').style.display = 'flex';
    document.getElementById('avis-nom').value = '';
    document.getElementById('avis-commentaire').value = '';
    noteAvisActuelle = 5;
    window.setNote(5);
};

window.fermerModaleAvis = function() {
    document.getElementById('avis-modal').style.display = 'none';
};

window.envoyerAvis = async function() {
    const nom = document.getElementById('avis-nom').value.trim();
    const commentaire = document.getElementById('avis-commentaire').value.trim();
    if (!nom || !commentaire) {
        showToast("Remplis ton nom et ton commentaire", "error");
        return;
    }
    try {
        await database.ref('kbt_avis_globaux').push({
            nom: nom,
            note: noteAvisActuelle,
            commentaire: commentaire,
            date: firebase.database.ServerValue.TIMESTAMP
        });
        showToast("✅ Merci pour ton avis !", "success");
        window.fermerModaleAvis();
    } catch (err) {
        showToast("Erreur lors de l'envoi", "error");
    }
};

function renderAvis() {
    const moyenneEl = document.getElementById('avis-moyenne');
    const listEl = document.getElementById('avis-list');
    if (!moyenneEl || !listEl) return;

    if (avisList.length === 0) {
        moyenneEl.innerHTML = '<p style="color:#A0AEC0;">Aucun avis pour l\'instant. Soyez le premier !</p>';
        listEl.innerHTML = '';
        return;
    }

    const somme = avisList.reduce((sum, a) => sum + a.note, 0);
    const moyenne = (somme / avisList.length).toFixed(1);
    const etoiles = '⭐'.repeat(Math.round(moyenne));

    moyenneEl.innerHTML = `
        <div class="note-big">${moyenne}/5</div>
        <div style="font-size:1.2rem;margin:5px 0;">${etoiles}</div>
        <div class="avis-count">${avisList.length} avis client(s)</div>
    `;

    const derniers = avisList.slice(0, 5);
    listEl.innerHTML = derniers.map(a => {
        const date = a.date ? new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
        return `
            <div class="avis-item">
                <div class="avis-header">
                    <span class="avis-nom">${escapeHTML(a.nom)}</span>
                    <span class="avis-date">${date}</span>
                </div>
                <div class="avis-note">${'⭐'.repeat(a.note)}</div>
                <p class="avis-commentaire">${escapeHTML(a.commentaire)}</p>
            </div>
        `;
    }).join('');
}

// ============================================
// CLUB FITNESS — RÈGLEMENT
// ============================================
window.toggleRulesFitness = function () {
    const content = document.getElementById('rules-fitness-content');
    const arrow = document.getElementById('rules-fitness-arrow');
    if (!content || !arrow) return;
    content.classList.toggle('open');
    arrow.textContent = content.classList.contains('open') ? '▲' : '▼';
};

// ============================================
// CLUB FITNESS — SÉLECTION FORMULE
// ============================================
window.selectFormule = function (formuleId, element) {
    document.querySelectorAll('.formule-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    formuleFitnessChoisie = FORMULES_FITNESS[formuleId];

    const recalc = document.getElementById('formule-recap');
    const recapNom = document.getElementById('recap-formule-nom');
    const recapPrice = document.getElementById('recap-formule-price');
    const montant = document.getElementById('fitness-montant');
    const totalPrice = document.getElementById('fitness-total-price');
    const form = document.getElementById('fitness-form');

    if (formuleFitnessChoisie) {
        const prix = formuleFitnessChoisie.inscription;
        const prixStr = new Intl.NumberFormat('fr-FR').format(prix) + ' F';
        recapNom.textContent = formuleFitnessChoisie.nom;
        recapPrice.textContent = prixStr;
        montant.textContent = prixStr;
        totalPrice.textContent = prixStr;
        recalc.style.display = 'flex';
        form.style.display = 'block';
        setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
};

// ============================================
// CLUB FITNESS — CHARGEMENT
// ============================================
function chargerAbonnementsFitness() {
    database.ref('kbt_fitness_abonnements').on('value', (snapshot) => {
        abonnementsFitness = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                abonnementsFitness.push({ firebaseKey: key, ...data[key] });
            });
        }
        if (isAdminFitness) renderAdminFitness();
    });
}

// ============================================
// CLUB FITNESS — FORMULAIRE
// ============================================
function initialiserFormulaireFitness() {
    const form = document.getElementById('fitness-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        if (!formuleFitnessChoisie) {
            showToast("Veuillez choisir une formule.", "error");
            return;
        }

        const nom = document.getElementById('fitness-nom').value.trim();
        const tel = document.getElementById('fitness-tel').value.trim();
        const dateDebut = document.getElementById('fitness-date').value;

        if (!nom || !tel || !dateDebut) {
            showToast("Remplissez tous les champs.", "error");
            return;
        }

        const tempId = 'fit_' + Date.now();
        pendingFitnessInscription = {
            id: tempId,
            nom,
            telephone: tel,
            formuleId: formuleFitnessChoisie.id,
            formuleNom: formuleFitnessChoisie.nom,
            type: formuleFitnessChoisie.type,
            dateDebut,
            montantInscription: formuleFitnessChoisie.inscription,
            mensualite: formuleFitnessChoisie.mensualite || 0,
            entree: formuleFitnessChoisie.entree || 0,
            paiement: 'wave',
            statut: 'en_attente',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        pendingType = 'fitness';
        ouvrirModalePaiementFitness(pendingFitnessInscription);
    };
}

function ouvrirModalePaiementFitness(inscription) {
    const modal = document.getElementById('payment-modal');
    const montant = document.getElementById('modal-montant');
    montant.innerText = new Intl.NumberFormat('fr-FR').format(inscription.montantInscription) + " FCFA";
    lienPaiementActuel = WAVE_LINK;
    document.getElementById('modal-step-1').style.display = 'block';
    document.getElementById('modal-step-2').style.display = 'none';
    modal.style.display = 'flex';
}

// ============================================
// MODALE PAIEMENT
// ============================================
function ouvrirModalePaiement(reservation, methode) {
    const modal = document.getElementById('payment-modal');
    const montant = document.getElementById('modal-montant');
    montant.innerText = new Intl.NumberFormat('fr-FR').format(reservation.acompte) + " FCFA";
    lienPaiementActuel = methode === 'orange-money' ? OM_LINK : WAVE_LINK;
    document.getElementById('modal-step-1').style.display = 'block';
    document.getElementById('modal-step-2').style.display = 'none';
    modal.style.display = 'flex';
}

window.ouvrirPaiement = function () {
    window.open(lienPaiementActuel, '_blank');
    document.getElementById('modal-step-1').style.display = 'none';
    document.getElementById('modal-step-2').style.display = 'block';
};

window.retourEtape1 = function () {
    document.getElementById('modal-step-1').style.display = 'block';
    document.getElementById('modal-step-2').style.display = 'none';
};

window.fermerModalePaiement = async function () {
    document.getElementById('payment-modal').style.display = 'none';
    document.getElementById('modal-step-1').style.display = 'block';
    document.getElementById('modal-step-2').style.display = 'none';

    if (pendingType === 'fitness' && pendingFitnessInscription) {
        pendingFitnessInscription = null;
        pendingType = null;
    } else if (pendingType === 'football' && pendingReservation) {
        await database.ref(`kbt_reservations_temp/${pendingReservation.id}`).remove();
        pendingReservation = null;
        pendingType = null;
    }
};

window.confirmerPaiement = async function () {
    // --- FITNESS ---
    if (pendingType === 'fitness' && pendingFitnessInscription) {
        showLoader("Enregistrement...");
        const ins = pendingFitnessInscription;

        await database.ref(`kbt_fitness_abonnements/${ins.id}`).set({
            ...ins,
            statut: 'a_verifier',
            confirmedAt: firebase.database.ServerValue.TIMESTAMP
        });

        try {
            const msg = `💃 *NOUVELLE INSCRIPTION CLUB FITNESS*\n\n` +
                `👤 *Nom :* ${ins.nom}\n` +
                `📞 *Téléphone :* ${ins.telephone}\n` +
                `🎫 *Formule :* ${ins.formuleNom}\n` +
                `💰 *Inscription :* ${new Intl.NumberFormat('fr-FR').format(ins.montantInscription)} FCFA\n` +
                `📅 *Début :* ${ins.dateDebut}\n\n` +
                `✅ *À VALIDER dans l'admin !*`;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' })
            });
        } catch (err) { console.error(err); }

        hideLoader();
        document.getElementById('payment-modal').style.display = 'none';
        document.getElementById('modal-step-1').style.display = 'block';
        document.getElementById('modal-step-2').style.display = 'none';
        pendingFitnessInscription = null;
        pendingType = null;
        document.getElementById('fitness-form').reset();
        document.getElementById('fitness-form').style.display = 'none';
        document.getElementById('formule-recap').style.display = 'none';
        document.querySelectorAll('.formule-card').forEach(c => c.classList.remove('selected'));
        formuleFitnessChoisie = null;
        showToast("✅ Inscription envoyée ! En attente de validation admin.", "success");
        return;
    }

    // --- FOOTBALL ---
    if (pendingType === 'football' && pendingReservation) {
        showLoader("Vérification du créneau...");
        const res = pendingReservation;
        const dateRes = res.date;
        const mesCreneaux = res.slot.split(', ');
        const snap = await database.ref(`kbt_reservations_payees/${dateRes}`).once('value');
        const reserves = snap.val() || [];
        const pending = getCreneauxPending(dateRes);
        const conflit = mesCreneaux.some(c => reserves.includes(c) || pending.includes(c));

        if (conflit) {
            hideLoader();
            await database.ref(`kbt_reservations_temp/${res.id}`).remove();
            pendingReservation = null;
            pendingType = null;
            document.getElementById('payment-modal').style.display = 'none';
            document.getElementById('modal-step-1').style.display = 'block';
            document.getElementById('modal-step-2').style.display = 'none';
            showToast("Désolé, ce créneau vient d'être pris !", "error");
            return;
        }

        const expire_at = Date.now() + VALIDATION_DELAY_MS;
        await database.ref(`kbt_reservations_admin/${res.id}`).set({
            ...res,
            statut: 'a_verifier',
            expire_at: expire_at,
            confirmedAt: firebase.database.ServerValue.TIMESTAMP
        });
        await database.ref(`kbt_reservations_temp/${res.id}`).remove();
        await envoyerNotificationTelegram(res);

        hideLoader();
        document.getElementById('payment-modal').style.display = 'none';
        document.getElementById('modal-step-1').style.display = 'block';
        document.getElementById('modal-step-2').style.display = 'none';
        pendingReservation = null;
        pendingType = null;

        showToast("✅ Réservation envoyée ! En attente de validation (30 min).", "success");
        document.getElementById('reservation-form').reset();
        selectedSlot = null;
    }
};

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('date-match');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
    }
    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    initialiserApplication();
    chargerAbonnementsFitness();
    initialiserFormulaireFitness();
    initAdminTerrain();
    initAdminFitness();
});

function initialiserApplication() {
    const form = document.getElementById('reservation-form');
    const dateInput = document.getElementById('date-match');

    window.calculerPrix();

    database.ref('kbt_reservations_payees').on('value', (snapshot) => {
        reservationsPayees = snapshot.val() || {};
        genererCreneaux();
    });

    database.ref('kbt_reservations_admin').on('value', (snapshot) => {
        reservationsAdmin = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                reservationsAdmin.push({ firebaseKey: key, ...data[key] });
            });
        }
        genererCreneaux();
        if (isAdminTerrain) renderAdmin();
    });

    database.ref('kbt_avis_globaux').orderByChild('date').limitToLast(50).on('value', (snapshot) => {
        avisList = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => { avisList.push({ id: key, ...data[key] }); });
            avisList.reverse();
        }
        renderAvis();
    });

    setInterval(nettoyerReservationsExpirees, 30000);

    function genererCreneaux() {
        const slotsContainer = document.getElementById('slots-container');
        if (!slotsContainer || !dateInput) return;
        slotsContainer.innerHTML = '';
        const dateSelectionnee = dateInput.value;
        if (!dateSelectionnee) return;
        const reserves = reservationsPayees[dateSelectionnee] || [];
        const pending = getCreneauxPending(dateSelectionnee);

        for (let i = 7; i <= 11; i++) creerBoutonCreneau(`${formaterHeure(i)} - ${formaterHeure(i + 1)}`, reserves, pending, dateSelectionnee);
        creerBoutonCreneau("12h - 12h15", reserves, pending, dateSelectionnee);

        const pauseDiv = document.createElement('div');
        pauseDiv.className = 'pause-message';
        pauseDiv.innerHTML = `<span>⏸️</span><span>Fermeture de 12h15 à 16h00</span><span>⏸️</span>`;
        slotsContainer.appendChild(pauseDiv);

        for (let i = 16; i <= 23; i++) creerBoutonCreneau(`${formaterHeure(i)} - ${formaterHeure(i + 1)}`, reserves, pending, dateSelectionnee);
        creerBoutonCreneau("00h - 01h", reserves, pending, dateSelectionnee);
        creerBoutonCreneau("01h - 03h15", reserves, pending, dateSelectionnee);

        const btns = slotsContainer.querySelectorAll('.slot-btn');
        btns.forEach((btn, i) => { btn.style.animationDelay = `${Math.min(i * 0.03, 0.6)}s`; });

        const disponibles = slotsContainer.querySelectorAll('.slot-btn:not(:disabled)');
        const counter = document.getElementById('slots-count');
        if (counter) counter.textContent = disponibles.length;
    }

    function creerBoutonCreneau(slotName, reserves, pending, dateSelectionnee) {
        const slotsContainer = document.getElementById('slots-container');
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "slot-btn ripple";
        btn.innerText = slotName;
        const isBlocked = isSlotBlocked(dateSelectionnee, slotName);
        const blockedReason = getBlockedReason(dateSelectionnee, slotName);

        if (isBlocked) {
            btn.disabled = true;
            btn.className = "slot-btn disabled blocked-slot";
            btn.innerText = `${slotName} (❌ ${blockedReason})`;
        } else if (reserves.includes(slotName)) {
            btn.disabled = true;
            btn.className = "slot-btn disabled";
            btn.innerText = `${slotName} (❌ Réservé)`;
        } else if (pending.includes(slotName)) {
            btn.disabled = true;
            btn.className = "slot-btn disabled";
            btn.innerText = `${slotName} (⏳ En attente)`;
            btn.style.background = 'linear-gradient(135deg, #FFCC00, #E6B800)';
            btn.style.color = '#000';
            btn.style.opacity = '0.9';
            btn.style.border = '2px solid #B38F00';
            btn.style.textDecoration = 'none';
        } else {
            btn.onclick = function () {
                document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                selectedSlot = slotName;
            };
        }
        slotsContainer.appendChild(btn);
    }

    if (dateInput) {
        dateInput.addEventListener('change', () => {
            selectedSlot = null;
            genererCreneaux();
            afficherBandeauBlocage(dateInput.value);
        });
    }

    function afficherBandeauBlocage(dateStr) {
        const info = document.getElementById('blocked-info');
        if (!info) return;
        const blockedDates = [
            '2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26',
            '2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24',
            '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'
        ];
        info.style.display = blockedDates.includes(dateStr) ? 'block' : 'none';
    }

    if (dateInput) afficherBandeauBlocage(dateInput.value);

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('full-name');
            const phoneInput = document.getElementById('whatsapp-number');
            const equipeAInput = document.getElementById('equipe-a');
            const equipeBInput = document.getElementById('equipe-b');
            const paiementSelect = document.getElementById('methode-paiement');
            const dureeValue = parseInt(document.getElementById('duree').value, 10);
            const tarifValue = parseInt(document.getElementById('tarif-select').value, 10);

            if (!selectedSlot) {
                showToast("Veuillez choisir un créneau horaire !", "error");
                document.querySelector('.slots-grid').classList.add('shake');
                setTimeout(() => document.querySelector('.slots-grid').classList.remove('shake'), 600);
                return;
            }

            const dateSelectionnee = dateInput.value;
            if (isSlotBlocked(dateSelectionnee, selectedSlot)) {
                return showToast("Ce créneau est réservé (douaniers).", "error");
            }

            const reserves = reservationsPayees[dateSelectionnee] || [];
            const pending = getCreneauxPending(dateSelectionnee);
            if (reserves.includes(selectedSlot) || pending.includes(selectedSlot)) {
                return showToast("Ce créneau vient d'être réservé.", "error");
            }

            const listeCreneaux = [selectedSlot];
            if (dureeValue === 2) {
                if (selectedSlot === "12h - 12h15" || selectedSlot === "01h - 03h15") {
                    return showToast("Impossible de réserver 2h sur ce créneau.", "error");
                }
                const parties = selectedSlot.split(' - ');
                const heureFin = parseInt(parties[1].replace('h', ''), 10);
                const secondSlot = `${formaterHeure(heureFin)} - ${formaterHeure(heureFin + 1)}`;
                if (reserves.includes(secondSlot) || pending.includes(secondSlot) || isSlotBlocked(dateSelectionnee, secondSlot)) {
                    return showToast("Le créneau suivant est déjà pris ou bloqué.", "error");
                }
                listeCreneaux.push(secondSlot);
            }

            const total = tarifValue * dureeValue;
            const acompte = Math.round(total / 2);
            const tempId = 'temp_' + Date.now();

            const reservationData = {
                id: tempId,
                name: nameInput.value,
                phone: phoneInput.value,
                date: dateSelectionnee,
                equipeA: equipeAInput.value,
                equipeB: equipeBInput.value,
                slot: listeCreneaux.join(', '),
                duree: dureeValue + "h",
                prixTotal: total,
                acompte: acompte,
                paiement: paiementSelect.value,
                statut: 'en_attente',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            try {
                await database.ref(`kbt_reservations_temp/${tempId}`).set(reservationData);
                pendingReservation = reservationData;
                pendingType = 'football';
                ouvrirModalePaiement(reservationData, paiementSelect.value);
            } catch (err) {
                showToast("Erreur de connexion", "error");
            }
        };
    }

    setInterval(() => {
        const limite = Date.now() - 30 * 60 * 1000;
        database.ref('kbt_reservations_temp').once('value').then((snap) => {
            const data = snap.val() || {};
            Object.keys(data).forEach((key) => {
                if (data[key].createdAt && data[key].createdAt < limite) {
                    database.ref(`kbt_reservations_temp/${key}`).remove();
                }
            });
        });
    }, 5 * 60 * 1000);

    document.addEventListener('click', function(e) {
        const target = e.target.closest('button.ripple');
        if (!target) return;
        target.classList.remove('ripple-anim');
        void target.offsetWidth;
        target.classList.add('ripple-anim');
        setTimeout(() => target.classList.remove('ripple-anim'), 700);
    });
}

async function nettoyerReservationsExpirees() {
    const now = Date.now();
    const snap = await database.ref('kbt_reservations_admin').once('value');
    const data = snap.val() || {};
    Object.keys(data).forEach((key) => {
        const r = data[key];
        if (r.statut === 'a_verifier' && r.expire_at && r.expire_at < now) {
            database.ref(`kbt_reservations_admin/${key}`).remove();
        }
    });
}

// ============================================
// ADMIN TERRAIN
// ============================================
function initAdminTerrain() {
    const btn = document.getElementById('btn-ouvrir-admin-terrain');
    if (!btn) return;
    btn.onclick = () => {
        const saisie = prompt("🔐 Code Admin Terrain :");
        if (saisie === ADMIN_PASSWORD_TERRAIN) {
            document.getElementById('admin-panel-terrain').style.display = 'block';
            isAdminTerrain = true;
            renderAdmin();
            showToast("Bienvenue Admin Terrain ! ⚽", "success");
            setTimeout(() => {
                document.getElementById('admin-panel-terrain').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        } else if (saisie !== null) {
            showToast("Code incorrect", "error");
        }
    };
}

window.fermerAdminTerrain = function () {
    document.getElementById('admin-panel-terrain').style.display = 'none';
    isAdminTerrain = false;
};

// ============================================
// ADMIN FITNESS
// ============================================
function initAdminFitness() {
    const btn = document.getElementById('btn-ouvrir-admin-fitness');
    if (!btn) return;
    btn.onclick = () => {
        const saisie = prompt("🔐 Code Admin Fitness :");
        if (saisie === ADMIN_PASSWORD_FITNESS) {
            document.getElementById('admin-panel-fitness').style.display = 'block';
            isAdminFitness = true;
            renderAdminFitness();
            showToast("Bienvenue Admin Fitness ! 💃", "success");
            setTimeout(() => {
                document.getElementById('admin-panel-fitness').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        } else if (saisie !== null) {
            showToast("Code incorrect", "error");
        }
    };
}

window.fermerAdminFitness = function () {
    document.getElementById('admin-panel-fitness').style.display = 'none';
    isAdminFitness = false;
};

setInterval(() => {
    if (isAdminTerrain) renderAdmin();
    if (isAdminFitness) renderAdminFitness();
}, 1000);

// ============================================
// STATS ADMIN TERRAIN
// ============================================
function renderStats() {
    const grid = document.getElementById('admin-stats-grid');
    if (!grid) return;
    const now = new Date();
    const moisActuel = now.getMonth();
    const anneeActuelle = now.getFullYear();
    const aujourdhui = now.toISOString().split('T')[0];
    const validees = reservationsAdmin.filter(r => r.statut === 'valide');

    const revenusMois = validees
        .filter(r => { if (!r.valideAt) return false; const d = new Date(r.valideAt); return d.getMonth() === moisActuel && d.getFullYear() === anneeActuelle; })
        .reduce((sum, r) => sum + (r.acompte || 0), 0);

    const resaMois = validees.filter(r => { if (!r.valideAt) return false; const d = new Date(r.valideAt); return d.getMonth() === moisActuel && d.getFullYear() === anneeActuelle; }).length;
    const resaAujourdhui = validees.filter(r => r.date === aujourdhui).length;

    const creneauxParJour = 17;
    const joursDuMois = new Date(anneeActuelle, moisActuel + 1, 0).getDate();
    const creneauxTotalMois = joursDuMois * creneauxParJour;
    const creneauxOccupes = validees
        .filter(r => { if (!r.valideAt) return false; const d = new Date(r.valideAt); return d.getMonth() === moisActuel && d.getFullYear() === anneeActuelle; })
        .reduce((sum, r) => sum + r.slot.split(', ').length, 0);
    const tauxOccupation = creneauxTotalMois > 0 ? Math.round((creneauxOccupes / creneauxTotalMois) * 100) : 0;

    const clients = new Set(validees.map(r => r.phone));
    const nbClients = clients.size;

    const compteurCreneaux = {};
    validees.forEach(r => { r.slot.split(', ').forEach(s => { const slot = s.trim(); compteurCreneaux[slot] = (compteurCreneaux[slot] || 0) + 1; }); });
    let creneauPopulaire = '-';
    let maxCreneaux = 0;
    Object.keys(compteurCreneaux).forEach(slot => { if (compteurCreneaux[slot] > maxCreneaux) { maxCreneaux = compteurCreneaux[slot]; creneauPopulaire = slot; } });

    const stats = [
        { label: 'Revenus du mois', value: new Intl.NumberFormat('fr-FR').format(revenusMois) + ' F', color: '#28a745', icon: '💰' },
        { label: 'Résa ce mois', value: resaMois, color: '#FFCC00', icon: '📅' },
        { label: 'Résa aujourd\'hui', value: resaAujourdhui, color: '#3b82f6', icon: '🕐' },
        { label: 'Taux d\'occupation', value: tauxOccupation + '%', color: '#a855f7', icon: '🎯' },
        { label: 'Clients uniques', value: nbClients, color: '#ec4899', icon: '👥' },
        { label: 'Créneau populaire', value: creneauPopulaire, color: '#FFCC00', icon: '🏆' },
    ];

    grid.innerHTML = stats.map(s => `
        <div style="background: linear-gradient(135deg, #1a1a1a, #0f0f0f); border: 1px solid #262626; border-left: 3px solid ${s.color}; border-radius: 8px; padding: 15px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <span style="font-size:1.3rem;">${s.icon}</span>
                <span style="font-size:0.75rem; color:#A0AEC0; text-transform:uppercase; letter-spacing:0.5px;">${s.label}</span>
            </div>
            <div style="font-size:1.3rem; font-weight:800; color:${s.color}; text-shadow:0 0 15px ${s.color}40;">${s.value}</div>
        </div>
    `).join('');
}

// ============================================
// RAPPORT PDF
// ============================================
window.genererRapportPDF = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const now = new Date();
    const moisActuel = now.getMonth();
    const anneeActuelle = now.getFullYear();
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                     'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const moisNom = moisNoms[moisActuel];

    const validees = reservationsAdmin.filter(r => {
        if (r.statut !== 'valide' || !r.valideAt) return false;
        const d = new Date(r.valideAt);
        return d.getMonth() === moisActuel && d.getFullYear() === anneeActuelle;
    });

    const revenusMois = validees.reduce((sum, r) => sum + (r.acompte || 0), 0);
    const revenusTotal = validees.reduce((sum, r) => sum + (r.prixTotal || 0), 0);
    const creneauxParJour = 17;
    const joursDuMois = new Date(anneeActuelle, moisActuel + 1, 0).getDate();
    const creneauxTotalMois = joursDuMois * creneauxParJour;
    const creneauxOccupes = validees.reduce((sum, r) => sum + r.slot.split(', ').length, 0);
    const tauxOccupation = creneauxTotalMois > 0 ? Math.round((creneauxOccupes / creneauxTotalMois) * 100) : 0;
    const clients = new Set(validees.map(r => r.phone));
    const clientsUniques = clients.size;

    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 204, 0);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('KBT SPORT', 105, 18, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Rapport mensuel - ' + moisNom + ' ' + anneeActuelle, 105, 30, { align: 'center' });

    let yPos = 55;
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Resume du mois', 15, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Revenus encaisses (acomptes) : ' + new Intl.NumberFormat('fr-FR').format(revenusMois) + ' FCFA', 15, yPos);
    yPos += 7;
    doc.text('Chiffre d\'affaires total : ' + new Intl.NumberFormat('fr-FR').format(revenusTotal) + ' FCFA', 15, yPos);
    yPos += 7;
    doc.text('Nombre de reservations : ' + validees.length, 15, yPos);
    yPos += 7;
    doc.text('Taux d\'occupation : ' + tauxOccupation + '%', 15, yPos);
    yPos += 7;
    doc.text('Clients uniques : ' + clientsUniques, 15, yPos);
    yPos += 15;

    if (validees.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('2. Detail des reservations (' + validees.length + ')', 15, yPos);
        yPos += 5;

        const tableData = validees.map(r => [
            r.name || '',
            r.phone || '',
            r.date || '',
            r.slot || '',
            new Intl.NumberFormat('fr-FR').format(r.acompte) + ' F',
            r.paiement === 'wave' ? 'Wave' : 'OM'
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Client', 'Telephone', 'Date', 'Creneau', 'Acompte', 'Paiement']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [255, 204, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
            alternateRowStyles: { fillColor: [250, 250, 250] }
        });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('KBT SPORT - Karang Poste | Genere le ' + new Date().toLocaleDateString('fr-FR'), 105, 290, { align: 'center' });
        doc.text('Page ' + i + ' / ' + pageCount, 200, 290, { align: 'right' });
    }

    doc.save('KBT-SPORT-Rapport-' + moisNom + '-' + anneeActuelle + '.pdf');
    showToast('✅ Rapport PDF téléchargé !', 'success');
};

// ============================================
// EXPORT EXCEL
// ============================================
window.exporterReservationsExcel = function () {
    if (typeof XLSX === 'undefined') {
        showToast("Erreur : librairie Excel non chargée", "error");
        return;
    }

    const toutes = [...reservationsAdmin].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (toutes.length === 0) {
        showToast("Aucune réservation à exporter.", "info");
        return;
    }

    const wb = XLSX.utils.book_new();

    const dataAll = toutes.map(r => ({
        'Date': r.date || '',
        'Créneau': r.slot || '',
        'Statut': r.statut === 'valide' ? 'Validée' : (r.statut === 'a_verifier' ? 'En attente' : r.statut || ''),
        'Client': r.name || '',
        'Téléphone': r.phone || '',
        'Équipe A': r.equipeA || '',
        'Équipe B': r.equipeB || '',
        'Durée': r.duree || '',
        'Prix total (FCFA)': r.prixTotal || 0,
        'Acompte (FCFA)': r.acompte || 0,
        'Paiement': r.paiement === 'wave' ? 'Wave' : 'Orange Money',
        'Date validation': r.valideAt ? new Date(r.valideAt).toLocaleDateString('fr-FR') : ''
    }));

    const wsAll = XLSX.utils.json_to_sheet(dataAll);
    wsAll['!cols'] = [
        { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
        { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAll, 'Toutes les réservations');

    const parMois = {};
    toutes.forEach(r => {
        if (!r.date) return;
        const key = r.date.substring(0, 7);
        if (!parMois[key]) parMois[key] = [];
        parMois[key].push(r);
    });

    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    Object.keys(parMois).sort().forEach(key => {
        const [year, month] = key.split('-');
        const nomMois = `${moisNoms[parseInt(month, 10) - 1]} ${year}`;

        const data = parMois[key].map(r => ({
            'Date': r.date || '',
            'Créneau': r.slot || '',
            'Statut': r.statut === 'valide' ? 'Validée' : 'En attente',
            'Client': r.name || '',
            'Téléphone': r.phone || '',
            'Équipe A': r.equipeA || '',
            'Équipe B': r.equipeB || '',
            'Acompte (FCFA)': r.acompte || 0,
            'Paiement': r.paiement === 'wave' ? 'Wave' : 'Orange Money'
        }));

        const totalAcompte = data.filter(r => r['Statut'] === 'Validée').reduce((sum, r) => sum + (r['Acompte (FCFA)'] || 0), 0);
        data.push({
            'Date': '', 'Créneau': '', 'Statut': '',
            'Client': '💰 TOTAL VALIDÉ', 'Téléphone': '', 'Équipe A': '', 'Équipe B': '',
            'Acompte (FCFA)': totalAcompte, 'Paiement': ''
        });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
            { wch: 15 }, { wch: 15 }, { wch: 16 }, { wch: 14 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, nomMois.substring(0, 31));
    });

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `KBT-SPORT-Reservations-${dateStr}.xlsx`);
    const nbMois = Object.keys(parMois).length;
    showToast(`✅ ${toutes.length} réservation(s) exportée(s) sur ${nbMois} mois !`, 'success');
};

// ============================================
// ADMIN TERRAIN — RENDU
// ============================================
function renderAdmin() {
    const adminTbody = document.getElementById('admin-tbody');
    const pendingContainer = document.getElementById('admin-pending-container');
    if (!adminTbody) return;
    renderStats();

    const pendingRes = reservationsAdmin.filter(r => r.statut === 'a_verifier');
    const validees = reservationsAdmin.filter(r => r.statut === 'valide');

    if (pendingContainer) {
        pendingContainer.innerHTML = `<h3 style="color: var(--primary-color); margin-bottom: 12px;">⏳ Réservations à valider (${pendingRes.length})</h3>`;
        if (pendingRes.length === 0) {
            pendingContainer.innerHTML += `<p style="color:#A0AEC0; font-size:0.9rem;">Aucune réservation à valider.</p>`;
        } else {
            pendingRes.forEach((r) => {
                const secondesRestantes = r.expire_at ? Math.max(0, Math.floor((r.expire_at - Date.now()) / 1000)) : 0;
                const minutes = Math.floor(secondesRestantes / 60);
                const secondes = secondesRestantes % 60;
                const div = document.createElement('div');
                div.style.cssText = 'background: linear-gradient(135deg, #2a2300, #1a1500); border-left: 4px solid #FFCC00; padding: 15px; border-radius: 8px; margin-bottom: 12px;';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
                        <strong style="color:#FFCC00;">${escapeHTML(r.name)}</strong>
                        <span class="badge-paye" style="background:#dc3545; color:white; padding:2px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;">⏰ ${minutes}min ${secondes}s</span>
                    </div>
                    <p style="color:#E2E8F0; font-size:0.9rem; margin-bottom:5px;">📞 ${escapeHTML(r.phone)}</p>
                    <p style="color:#E2E8F0; font-size:0.9rem; margin-bottom:5px;">📅 ${escapeHTML(r.date)} — ${escapeHTML(r.slot)}</p>
                    <p style="color:#E2E8F0; font-size:0.9rem; margin-bottom:5px;">⚽ ${escapeHTML(r.equipeA)} vs ${escapeHTML(r.equipeB)}</p>
                    <p style="color:#FFCC00; font-size:0.9rem; margin-bottom:10px;">💰 Acompte : ${new Intl.NumberFormat('fr-FR').format(r.acompte)} FCFA (${r.paiement === 'wave' ? 'Wave' : 'OM'})</p>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-valider-attract ripple" onclick="validerReservation('${r.firebaseKey}')" style="background:#28a745;color:white;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Valider</button>
                        <button class="btn-rejeter-attract ripple" onclick="rejeterReservation('${r.firebaseKey}')" style="background:#dc3545;color:white;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">❌ Rejeter</button>
                    </div>
                `;
                pendingContainer.appendChild(div);
            });
        }
    }

    adminTbody.innerHTML = '';
    validees.forEach((r) => {
        const row = adminTbody.insertRow();
        const methode = r.paiement === 'orange-money' ? '🟠 OM' : '🌊 Wave';
        row.innerHTML = `
            <td>${escapeHTML(r.name)} <br><small style="color:#A0AEC0;">${methode} — ${new Intl.NumberFormat('fr-FR').format(r.acompte)} F</small></td>
            <td>${escapeHTML(r.date)} <br><strong>${escapeHTML(r.slot)}</strong></td>
            <td><button class="ripple" onclick="supprimerReservation('${r.firebaseKey}')" title="Archiver">✅</button></td>
            <td>${escapeHTML(r.equipeA) || '-'}</td>
            <td>${escapeHTML(r.equipeB) || '-'}</td>
        `;
    });
}

window.validerReservation = async function (key) {
    const res = reservationsAdmin.find(r => r.firebaseKey === key);
    if (!res) return;
    showLoader("Validation...");
    const dateRes = res.date;
    const snap = await database.ref(`kbt_reservations_payees/${dateRes}`).once('value');
    const reserves = snap.val() || [];
    const mesCreneaux = res.slot.split(', ');
    const nouvelles = [...new Set([...reserves, ...mesCreneaux])];
    await database.ref(`kbt_reservations_payees/${dateRes}`).set(nouvelles);
    await database.ref(`kbt_reservations_admin/${key}`).update({ statut: 'valide', expire_at: null, valideAt: firebase.database.ServerValue.TIMESTAMP });
    const phone = res.phone.startsWith("221") ? res.phone : "221" + res.phone;
    const msg = `*KBT SPORT - CONFIRMATION*%0A%0ABonjour ${res.name}, votre paiement a bien été reçu !%0AVotre réservation du ${res.date} sur le créneau *${res.slot}* (${res.equipeA} vs ${res.equipeB}) est validée. 👍`;
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    hideLoader();
    showToast("✅ Réservation validée !", "success");
};

window.rejeterReservation = async function (key) {
    if (!confirm("Rejeter cette réservation ?")) return;
    await database.ref(`kbt_reservations_admin/${key}`).remove();
    showToast("Réservation rejetée.", "info");
};

window.supprimerReservation = async function (key) {
    if (!confirm("Archiver cette réservation ?")) return;
    const res = reservationsAdmin.find(r => r.firebaseKey === key);
    if (!res) return;
    const dateRes = res.date;
    const snap = await database.ref(`kbt_reservations_payees/${dateRes}`).once('value');
    const reserves = snap.val() || [];
    const mesCreneaux = res.slot.split(', ');
    const nouvelles = reserves.filter(c => !mesCreneaux.includes(c));
    if (nouvelles.length > 0) await database.ref(`kbt_reservations_payees/${dateRes}`).set(nouvelles);
    else await database.ref(`kbt_reservations_payees/${dateRes}`).remove();
    await database.ref(`kbt_reservations_admin/${key}`).remove();
    showToast("Réservation archivée", "success");
};

// ============================================
// ADMIN FITNESS — RENDU
// ============================================
function renderAdminFitness() {
    const statsEl = document.getElementById('admin-fitness-stats');
    const pendingEl = document.getElementById('admin-fitness-pending-container');
    const membresEl = document.getElementById('admin-fitness-membres-list');
    if (!statsEl) return;

    const valides = abonnementsFitness.filter(a => a.statut === 'valide');
    const pending = abonnementsFitness.filter(a => a.statut === 'a_verifier');

    const now = new Date();
    const moisActuel = now.getMonth();
    const anneeActuelle = now.getFullYear();
    const revenusMois = valides
        .filter(a => {
            if (!a.valideAt) return false;
            const d = new Date(a.valideAt);
            return d.getMonth() === moisActuel && d.getFullYear() === anneeActuelle;
        })
        .reduce((sum, a) => sum + (a.montantInscription || 0), 0);

    const mois = valides.filter(a => a.type === 'abonnement').length;
    const seances = valides.filter(a => a.type === 'seance').length;

    statsEl.innerHTML = `
        <h3 style="color: var(--primary-color); margin-bottom: 15px;">📊 Statistiques Club Fitness</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
            <div style="background: linear-gradient(135deg, #1a1a1a, #0f0f0f); border: 1px solid #262626; border-left: 3px solid #28a745; border-radius: 8px; padding: 15px;">
                <div style="font-size:0.75rem; color:#A0AEC0; text-transform:uppercase; margin-bottom:6px;">💰 Revenus du mois</div>
                <div style="font-size:1.3rem; font-weight:800; color:#28a745;">${new Intl.NumberFormat('fr-FR').format(revenusMois)} F</div>
            </div>
            <div style="background: linear-gradient(135deg, #1a1a1a, #0f0f0f); border: 1px solid #262626; border-left: 3px solid #FFCC00; border-radius: 8px; padding: 15px;">
                <div style="font-size:0.75rem; color:#A0AEC0; text-transform:uppercase; margin-bottom:6px;">⭐ Abonnements</div>
                <div style="font-size:1.3rem; font-weight:800; color:#FFCC00;">${mois}</div>
            </div>
            <div style="background: linear-gradient(135deg, #1a1a1a, #0f0f0f); border: 1px solid #262626; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 15px;">
                <div style="font-size:0.75rem; color:#A0AEC0; text-transform:uppercase; margin-bottom:6px;">🎫 Séances</div>
                <div style="font-size:1.3rem; font-weight:800; color:#3b82f6;">${seances}</div>
            </div>
            <div style="background: linear-gradient(135deg, #1a1a1a, #0f0f0f); border: 1px solid #262626; border-left: 3px solid #a855f7; border-radius: 8px; padding: 15px;">
                <div style="font-size:0.75rem; color:#A0AEC0; text-transform:uppercase; margin-bottom:6px;">👥 Total membres</div>
                <div style="font-size:1.3rem; font-weight:800; color:#a855f7;">${valides.length}</div>
            </div>
        </div>
    `;

    pendingEl.innerHTML = `<h3 style="color: var(--primary-color); margin-bottom: 12px;">⏳ À valider (${pending.length})</h3>`;
    if (pending.length === 0) {
        pendingEl.innerHTML += `<p style="color:#A0AEC0; font-size:0.9rem;">Aucune inscription en attente.</p>`;
    } else {
        pending.forEach(a => {
            const div = document.createElement('div');
            div.style.cssText = 'background: linear-gradient(135deg, #2a2300, #1a1500); border-left: 4px solid #FFCC00; padding: 15px; border-radius: 8px; margin-bottom: 12px;';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
                    <strong style="color:#FFCC00;">${escapeHTML(a.nom)}</strong>
                    <span style="background:#FFCC00; color:#000; padding:2px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;">${escapeHTML(a.formuleNom)}</span>
                </div>
                <p style="color:#E2E8F0; font-size:0.9rem; margin-bottom:5px;">📞 ${escapeHTML(a.telephone)}</p>
                <p style="color:#E2E8F0; font-size:0.9rem; margin-bottom:5px;">📅 Début : ${escapeHTML(a.dateDebut)}</p>
                <p style="color:#FFCC00; font-size:0.9rem; margin-bottom:10px;">💰 Inscription : ${new Intl.NumberFormat('fr-FR').format(a.montantInscription)} FCFA (Wave)</p>
                <div style="display:flex; gap:8px;">
                    <button onclick="validerFitness('${a.firebaseKey}')" style="background:#28a745;color:white;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Valider</button>
                    <button onclick="rejeterFitness('${a.firebaseKey}')" style="background:#dc3545;color:white;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">❌ Rejeter</button>
                </div>
            `;
            pendingEl.appendChild(div);
        });
    }

    membresEl.innerHTML = '';
    if (valides.length === 0) {
        membresEl.innerHTML = '<p style="color:#A0AEC0; font-size:0.9rem;">Aucun membre inscrit.</p>';
    } else {
        valides.sort((a, b) => (b.valideAt || 0) - (a.valideAt || 0)).forEach(a => {
            const row = document.createElement('div');
            row.style.cssText = 'background: #1A1A1A; border-left: 3px solid #28a745; padding: 12px 15px; border-radius: 8px; margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;';
            row.innerHTML = `
                <div>
                    <strong style="color:#FFF;">${escapeHTML(a.nom)}</strong>
                    <span style="background:#28a745; color:white; padding:2px 8px; border-radius:10px; font-size:0.7rem; margin-left:8px;">${escapeHTML(a.formuleNom)}</span>
                    <p style="color:#A0AEC0; font-size:0.82rem; margin-top:4px;">📞 ${escapeHTML(a.telephone)} — 📅 ${escapeHTML(a.dateDebut)}</p>
                </div>
                <button onclick="supprimerFitness('${a.firebaseKey}')" style="background:#dc3545;color:white;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;">🗑️</button>
            `;
            membresEl.appendChild(row);
        });
    }
}

window.validerFitness = async function (key) {
    const a = abonnementsFitness.find(x => x.firebaseKey === key);
    if (!a) return;
    showLoader("Validation...");
    await database.ref(`kbt_fitness_abonnements/${key}`).update({
        statut: 'valide',
        valideAt: firebase.database.ServerValue.TIMESTAMP
    });
    hideLoader();
    showToast("✅ Membre validé !", "success");

    const phone = a.telephone.startsWith("221") ? a.telephone : "221" + a.telephone;
    const msg = `*KBT SPORT - CLUB FITNESS*%0A%0ABonjour ${a.nom}, votre inscription au *${a.formuleNom}* est validée ! 🎉%0A%0A📅 Début : ${a.dateDebut}%0A💰 Inscription payée : ${new Intl.NumberFormat('fr-FR').format(a.montantInscription)} FCFA%0A%0ABienvenue au Club Fitness KBT SPORT ! 💃`;
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
};

window.rejeterFitness = async function (key) {
    if (!confirm("Rejeter cette inscription ?")) return;
    await database.ref(`kbt_fitness_abonnements/${key}`).remove();
    showToast("Inscription rejetée.", "info");
};

window.supprimerFitness = async function (key) {
    if (!confirm("Supprimer ce membre ?")) return;
    await database.ref(`kbt_fitness_abonnements/${key}`).remove();
    showToast("Membre supprimé.", "info");
};

// ============================================
// COMPTEURS ANIMÉS
// ============================================
function animerCompteurs() {
    document.querySelectorAll('.stat-number').forEach((el) => {
        const target = +el.dataset.target;
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;
        const update = () => {
            current += step;
            if (current < target) { el.textContent = Math.floor(current); requestAnimationFrame(update); }
            else el.textContent = target;
        };
        update();
    });
}
setTimeout(animerCompteurs, 500);