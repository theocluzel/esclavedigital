require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');

// Base de données temporaire (à remplacer par une vraie base de données)
const users = new Map();
const chapters = new Map();
const sessions = new Map();

// Configuration de la session
app.use(session({
    secret: process.env.SESSION_SECRET || 'votre_secret_temporaire',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

// Middleware pour parser le JSON et servir les fichiers statiques
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Middleware d'authentification pour les routes protégées
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'Non autorisé' });
    }
};

// Route pour la page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route pour la page de paiement
app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment.html'));
});

// Route pour la page de succès
app.get('/success.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

// Route pour la page d'informations
app.get('/information.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'information.html'));
});

// Route pour les mentions légales
app.get('/mentions-legales.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'mentions-legales.html'));
});

// Route pour la politique de confidentialité
app.get('/politique-confidentialite.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'politique-confidentialite.html'));
});

// Route pour les CGV
app.get('/cgv.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cgv.html'));
});

// Route pour la page de configuration
app.get('/config.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'config.html'));
});

// Nouvelles routes pour l'authentification et l'accès au contenu
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    const user = users.get(email);
    if (!user) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    req.session.userId = user.id;
    res.json({ message: 'Connexion réussie' });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Déconnexion réussie' });
});

app.get('/api/check-auth', requireAuth, (req, res) => {
    res.json({ authenticated: true });
});

app.get('/api/chapters/:id', requireAuth, (req, res) => {
    const chapter = chapters.get(parseInt(req.params.id));
    if (!chapter) {
        return res.status(404).json({ message: 'Chapitre non trouvé' });
    }
    res.json(chapter);
});

// Route pour créer un compte après l'achat
app.post('/api/create-account', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Créer le compte directement (pour les tests)
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = Date.now().toString();
        users.set(email, {
            id: userId,
            email,
            password: hashedPassword
        });

        res.json({ message: 'Compte créé avec succès' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la création du compte' });
    }
});

// Route pour créer une session de paiement
app.post('/create-checkout-session', async (req, res) => {
    const { format, email, firstname, lastname } = req.body;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'ESCLAVE DIGITAL',
                        description: `Format de lecture : ${format}`,
                    },
                    unit_amount: 499, // 4.99€ en centimes
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success.html?format=${format}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/payment.html?format=${format}`,
            customer_email: email,
            metadata: {
                format,
                firstname,
                lastname
            }
        });

        res.json({ id: session.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour simuler un paiement réussi (uniquement pour les tests)
app.get('/test-payment', async (req, res) => {
    try {
        // Créer une session de test
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'ESCLAVE DIGITAL',
                        description: 'Format de lecture : Web Premium (TEST)',
                    },
                    unit_amount: 499,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success.html?format=web&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/payment.html?format=web`,
            customer_email: 'test@example.com'
        });

        // Simuler un paiement réussi en stockant la session
        sessions.set(session.id, {
            payment_status: 'paid',
            customer_email: 'test@example.com'
        });

        // Rediriger vers la page de succès
        res.redirect(`/success.html?format=web&session_id=${session.id}`);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: error.message });
    }
});

// Modifier la route de vérification du paiement pour prendre en compte les sessions de test
app.get('/verify-payment/:sessionId', async (req, res) => {
    try {
        // Vérifier d'abord dans les sessions de test
        const testSession = sessions.get(req.params.sessionId);
        if (testSession) {
            return res.json({ status: testSession.payment_status });
        }

        // Sinon, vérifier avec Stripe
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        res.json({ status: session.payment_status });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la vérification du paiement' });
    }
});

// Route de test
app.get('/test', (req, res) => {
    res.json({ message: 'Le serveur fonctionne correctement !' });
});

// Ajouter des chapitres de test
chapters.set(1, {
    id: 1,
    title: "Introduction",
    content: `
        <h2>Introduction</h2>
        <p>Bienvenue dans ESCLAVE DIGITAL, un livre qui explore notre relation complexe avec la technologie moderne.</p>
        <p>Dans ce chapitre introductif, nous allons découvrir pourquoi il est crucial de comprendre et de maîtriser notre utilisation du numérique.</p>
    `
});

chapters.set(2, {
    id: 2,
    title: "L'emprise du numérique",
    content: `
        <h2>L'emprise du numérique</h2>
        <p>Comment les technologies numériques ont-elles pris une telle place dans nos vies ?</p>
        <p>Nous explorerons les mécanismes subtils qui nous rendent dépendants de nos appareils.</p>
    `
});

chapters.set(3, {
    id: 3,
    title: "Reprendre le contrôle",
    content: `
        <h2>Reprendre le contrôle</h2>
        <p>Des solutions concrètes pour retrouver son autonomie numérique.</p>
        <p>Découvrez des stratégies pratiques pour utiliser la technologie de manière plus consciente.</p>
    `
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
}); 