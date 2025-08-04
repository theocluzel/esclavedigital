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

// Création du compte admin permanent
const createAdminAccount = async () => {
    try {
        const hashedPassword = await bcrypt.hash('123456', 10);
        users.set('theocluzel@gmail.com', {
            id: 'admin_user',
            email: 'theocluzel@gmail.com',
            password: hashedPassword,
            hasBookAccess: true
        });
        console.log('Compte admin créé avec succès');
    } catch (error) {
        console.error('Erreur lors de la création du compte admin:', error);
    }
};

// Créer le compte admin au démarrage
createAdminAccount();

// Configuration de la session
app.use(session({
    secret: process.env.SESSION_SECRET || 'votre_secret_temporaire',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 an
    }
}));

// Middleware pour parser le JSON et servir les fichiers statiques
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Route pour la page de lecture
app.get('/reader.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'reader.html'));
});

// Route pour la page de login
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
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
    const user = Array.from(users.values()).find(u => u.id === req.session.userId);
    res.json({ 
        authenticated: true,
        hasBookAccess: user ? user.hasBookAccess : false
    });
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
            password: hashedPassword,
            hasBookAccess: true  // Donner l'accès au livre
        });

        res.json({ message: 'Compte créé avec succès' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la création du compte' });
    }
});

// Route pour créer un compte permanent
app.get('/create-permanent-account', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash('123456', 10);
        users.set('theocluzel@gmail.com', {
            id: 'permanent_user',
            email: 'theocluzel@gmail.com',
            password: hashedPassword,
            hasBookAccess: true
        });
        res.json({ message: 'Compte permanent créé avec succès' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la création du compte permanent' });
    }
});

// Route pour créer une session de paiement
app.post('/create-checkout-session', async (req, res) => {
    const { format, email, firstname, lastname } = req.body;
    
    console.log('Création d\'une session de paiement:', { format, email, firstname, lastname });

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

        // Rediriger directement vers la page de paiement Stripe
        res.redirect(303, session.url);
    } catch (error) {
        console.error('Erreur lors de la création de la session:', error);
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
        <h1>Introduction</h1>
        
        <p>Dans un monde où la technologie numérique s'immisce dans chaque aspect de notre quotidien, il devient crucial de comprendre la nature de notre relation avec ces outils qui façonnent notre réalité. Ce livre n'est pas simplement un manifeste contre la technologie, mais plutôt une invitation à la réflexion sur notre manière de l'utiliser et de la laisser nous utiliser.</p>

        <p>Au fil des pages qui suivent, nous explorerons ensemble les mécanismes subtils qui ont transformé nos smartphones, nos ordinateurs et nos objets connectés en extensions de nous-mêmes. Nous découvrirons comment, petit à petit, nous sommes devenus dépendants de ces technologies, souvent sans même nous en rendre compte.</p>

        <p>Mais ce livre est avant tout un message d'espoir. Car comprendre notre relation avec le numérique, c'est faire le premier pas vers une utilisation plus consciente et maîtrisée de ces outils. C'est reprendre le contrôle sur notre vie numérique et, par extension, sur notre vie tout court.</p>

        <h2>Pourquoi ce livre ?</h2>

        <p>L'idée de ce livre est née d'une observation simple : nous passons de plus en plus de temps devant nos écrans, mais de moins en moins de temps à réfléchir à l'impact de cette pratique sur nos vies. Nous sommes devenus des esclaves digitaux, enchaînés à nos appareils par des liens invisibles mais puissants : la peur de manquer quelque chose, le besoin de validation sociale, l'addiction aux notifications...</p>

        <p>Dans les chapitres qui suivent, nous explorerons ces mécanismes en détail, mais surtout, nous découvrirons des solutions concrètes pour reprendre le contrôle. Car il est possible d'utiliser la technologie sans se laisser consumer par elle. Il est possible de profiter de ses avantages sans en subir les inconvénients.</p>
    `
});

chapters.set(2, {
    id: 2,
    title: "L'emprise du numérique",
    content: `
        <h1>L'emprise du numérique</h1>

        <p>Comment en sommes-nous arrivés là ? Comment la technologie a-t-elle réussi à prendre une telle place dans nos vies ? Pour comprendre ce phénomène, il faut remonter aux origines de notre relation avec le numérique et examiner les mécanismes psychologiques qui nous lient à nos appareils.</p>

        <h2>La dopamine, notre drogue quotidienne</h2>

        <p>Chaque notification, chaque "like", chaque nouveau message déclenche dans notre cerveau une petite dose de dopamine, ce neurotransmetteur du plaisir. Les concepteurs d'applications et de réseaux sociaux l'ont bien compris et ont optimisé leurs plateformes pour maximiser ces micro-récompenses. Nous sommes devenus accros à ces petites doses de plaisir instantané, créant un cycle de dépendance difficile à briser.</p>

        <h2>Le coût caché de la connectivité permanente</h2>

        <p>La connexion permanente a un prix : notre capacité d'attention. Les interruptions constantes fragmentent notre concentration, rendant difficile toute réflexion profonde ou travail créatif. Nous sommes devenus des êtres multitâches, passant d'une tâche à l'autre sans jamais nous investir pleinement dans aucune d'entre elles.</p>

        <p>Cette hyperconnectivité affecte également nos relations sociales. Paradoxalement, plus nous sommes connectés virtuellement, plus nous nous sentons seuls dans la vraie vie. Les conversations en face à face sont interrompues par des notifications, les moments de partage sont documentés plutôt que vécus, et l'intimité est compromise par le besoin constant de partager.</p>
    `
});

chapters.set(3, {
    id: 3,
    title: "Reprendre le contrôle",
    content: `
        <h1>Reprendre le contrôle</h1>

        <p>La bonne nouvelle, c'est qu'il n'est jamais trop tard pour reprendre le contrôle de notre vie numérique. Ce chapitre propose des solutions concrètes et applicables immédiatement pour retrouver un équilibre sain avec la technologie.</p>

        <h2>Stratégies pratiques</h2>

        <p>La première étape consiste à prendre conscience de nos habitudes numériques. Combien de fois par jour consultons-nous notre téléphone ? Combien d'heures passons-nous sur les réseaux sociaux ? Cette prise de conscience est essentielle pour initier le changement.</p>

        <h2>Créer des frontières numériques</h2>

        <p>Établissez des moments dans la journée où vous êtes totalement déconnecté. Cela peut être pendant les repas, une heure avant le coucher, ou pendant vos activités créatives. Ces périodes de déconnexion sont essentielles pour recharger votre cerveau et maintenir votre bien-être mental.</p>

        <h2>Cultiver l'attention profonde</h2>

        <p>Réapprenez à vous concentrer sur une seule tâche à la fois. Commencez par des périodes courtes de travail focalisé, sans interruption numérique, puis augmentez progressivement la durée. Vous serez surpris de voir à quel point votre productivité et votre créativité peuvent s'améliorer.</p>

        <p>La technologie n'est ni bonne ni mauvaise en soi - tout dépend de la façon dont nous l'utilisons. En appliquant les principes et stratégies présentés dans ce livre, vous pouvez transformer votre relation avec le numérique et retrouver une liberté que vous pensiez peut-être perdue.</p>
    `
});

// Route pour donner l'accès au livre à un utilisateur
app.post('/api/grant-access', async (req, res) => {
    const { email } = req.body;
    
    try {
        const user = users.get(email);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Ajouter l'accès au livre
        user.hasBookAccess = true;
        users.set(email, user);

        res.json({ message: 'Accès au livre accordé avec succès' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de l\'attribution de l\'accès' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
}); 