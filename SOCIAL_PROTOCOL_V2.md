# Social Protocol V2 - Documentazione

## Introduzione

Il **Social Protocol V2** è un'implementazione migliorata del protocollo social network per GunDB, ispirata al design di `social-protocol-v2.js`. Offre una struttura più organizzata e funzionalità avanzate rispetto all'implementazione base.

## Caratteristiche Principali

### 1. **Architettura Migliorata**
- **User Space**: I dati dell'utente sono salvati nel suo spazio personale (sovranità dei dati)
- **Discovery**: Timeline pubblica organizzata per data per migliori performance
- **Cache Profili**: Sistema di cache per ridurre le richieste di rete

### 2. **Funzionalità Avanzate**
- ✅ Timeline organizzata per data (`timeline/YYYY-MM-DD`)
- ✅ Threading/risposte migliorato
- ✅ Indice hashtag automatico
- ✅ Supporto media/IPFS (preparato per implementazione futura)
- ✅ Cache profili utente
- ✅ Gestione profili estesa

### 3. **Integrazione con Shogun SDK**
Il protocollo si integra perfettamente con Shogun SDK, utilizzando l'istanza GunDB già configurata.

## Utilizzo

### Hook React: `useSocialProtocol`

Il modo più semplice per usare il protocollo è attraverso l'hook React:

```typescript
import { useSocialProtocol } from '../hooks/useSocialProtocol';

function MyComponent() {
  const {
    socialNetwork,
    isReady,
    posts,
    loading,
    error,
    publishPost,
    viewGlobalTimeline,
    viewHashtag,
    getUserProfile,
    updateProfile,
  } = useSocialProtocol();

  // Pubblicare un post
  const handlePost = async () => {
    const result = await publishPost('Ciao mondo! #test');
    if (result.success) {
      console.log('Post pubblicato:', result.id);
    }
  };

  // Visualizzare la timeline
  useEffect(() => {
    if (isReady) {
      viewGlobalTimeline();
    }
  }, [isReady]);

  return (
    <div>
      {loading && <p>Caricamento...</p>}
      {posts.map(post => (
        <div key={post.id}>
          <p>{post.content}</p>
          <p>Autore: {post.authorProfile?.displayName || 'Anonimo'}</p>
        </div>
      ))}
    </div>
  );
}
```

### Classe SocialNetwork (Diretto)

Se preferisci usare la classe direttamente:

```typescript
import { SocialNetwork } from '../utils/socialProtocol';
import { useShogun } from 'shogun-button-react';

function MyComponent() {
  const { sdk } = useShogun();
  const [network, setNetwork] = useState<SocialNetwork | null>(null);

  useEffect(() => {
    if (sdk?.gun) {
      const socialNetwork = new SocialNetwork({
        appName: 'shogun-mistodon-clone-v1',
        shogunCore: sdk,
      });
      setNetwork(socialNetwork);
    }
  }, [sdk]);

  // Pubblicare un post
  const publish = async () => {
    if (network) {
      const result = await network.publishPost('Ciao! #hashtag');
      console.log(result);
    }
  };

  // Visualizzare timeline
  useEffect(() => {
    if (network) {
      const cleanup = network.viewGlobalTimeline((post) => {
        console.log('Nuovo post:', post);
      });

      return cleanup; // Cleanup quando il componente si smonta
    }
  }, [network]);
}
```

## API Reference

### `SocialNetwork` Class

#### Constructor
```typescript
new SocialNetwork(config: {
  appName?: string;
  shogunCore: ShogunCore;
})
```

#### Metodi Principali

##### `publishPost(text, mediaFile?, replyToId?)`
Pubblica un nuovo post.

```typescript
const result = await network.publishPost(
  'Testo del post #hashtag',
  null, // mediaFile (Blob) - opzionale
  null  // replyToId - opzionale, per risposte
);
```

##### `viewGlobalTimeline(callback)`
Visualizza la timeline globale. Restituisce una funzione di cleanup.

```typescript
const cleanup = network.viewGlobalTimeline((post) => {
  console.log('Post:', post);
  // post include authorProfile se disponibile
});

// Cleanup quando non serve più
cleanup();
```

##### `viewReplies(postId, callback)`
Visualizza le risposte a un post specifico.

```typescript
const cleanup = network.viewReplies('post_123', (reply) => {
  console.log('Risposta:', reply);
});
```

##### `viewHashtag(hashtag, callback)`
Visualizza i post con un hashtag specifico.

```typescript
const cleanup = network.viewHashtag('test', (post) => {
  console.log('Post con hashtag:', post);
});
```

##### `getUserProfile(userPub, callback)`
Ottiene il profilo di un utente (con cache).

```typescript
network.getUserProfile('user_pub_key', (profile) => {
  console.log('Profilo:', profile);
});
```

##### `updateProfile(profileData)`
Aggiorna il profilo dell'utente corrente.

```typescript
await network.updateProfile({
  displayName: 'Nuovo Nome',
  bio: 'Nuova bio',
  avatarCid: 'QmHash...'
});
```

## Struttura Dati

### Post Payload
```typescript
interface PostPayload {
  id: string;
  text: string;
  media?: string | null;  // CID IPFS
  authorPub: string;
  timestamp: number;
  replyTo?: string | null;
}
```

### Post con Autore
```typescript
interface PostWithAuthor extends Post {
  authorProfile?: {
    displayName?: string;
    avatarCid?: string | null;
    bio?: string;
  };
}
```

## Differenze con l'Implementazione Base

| Caratteristica | Implementazione Base | Protocol V2 |
|---------------|---------------------|-------------|
| Timeline | Singolo nodo `posts` | Organizzata per data `timeline/YYYY-MM-DD` |
| Profili | Caricati ogni volta | Cache locale |
| Hashtag | Non indicizzati | Indice automatico + riferimenti bidirezionali |
| Threading | Base | Migliorato con riferimenti bidirezionali |
| User Space | Solo globale | User Space + Discovery |
| Performance | Carica tutti i post | Carica per data (più efficiente) |
| Riferimenti | Unidirezionali | Bidirezionali (User↔Post, Post↔Tag, Post↔Reply) |
| Navigazione Grafo | Limitata | Completa in tutte le direzioni (GUN Design Pattern) |

## Migrazione

Per migrare dal sistema base al Protocol V2:

1. **Sostituisci `usePosts` con `useSocialProtocol`**:
   ```typescript
   // Prima
   const { posts, createPost } = usePosts();
   
   // Dopo
   const { posts, publishPost, viewGlobalTimeline } = useSocialProtocol();
   ```

2. **Aggiorna la creazione dei post**:
   ```typescript
   // Prima
   await createPost('Testo');
   
   // Dopo
   await publishPost('Testo');
   ```

3. **Usa `TimelineV2` invece di `Timeline`**:
   ```typescript
   import { TimelineV2 } from './components/TimelineV2';
   
   // Nel tuo componente
   <TimelineV2 />
   ```

## Componenti Disponibili

### `TimelineV2`
Componente completo che usa il Protocol V2. Include:
- Composer per nuovi post
- Visualizzazione timeline
- Supporto hashtag
- Indicatori di stato

```typescript
import { TimelineV2 } from './components/TimelineV2';

<TimelineV2 />
```

## Miglioramenti Basati su GUN Design Examples

### Riferimenti Bidirezionali (GUN Design Pattern)

Il protocollo è stato migliorato seguendo gli esempi di design di GUN per creare riferimenti bidirezionali espliciti tra le entità. Questo permette una navigazione più efficiente del grafo dei dati.

#### Riferimenti Implementati

1. **User ↔ Post (Bidirezionale)**
   - `post.path('author').put(user)` - Post → Author
   - `user.path('posts').set(post)` - User → Posts
   - Permette di navigare da un post all'autore e da un utente ai suoi post

2. **Post ↔ Tag (Bidirezionale)**
   - `tag.path('posts').set(post)` - Tag → Posts
   - `post.path('tags').set(tag)` - Post → Tags
   - Permette di navigare da un tag ai post e da un post ai suoi tag

3. **Post ↔ Reply (Bidirezionale)**
   - `parentPost.path('replies').set(reply)` - Parent → Replies
   - `reply.path('replyTo').put(parentPost)` - Reply → Parent
   - Permette di navigare da un post alle risposte e da una risposta al post originale

#### Nuovi Metodi di Navigazione

```typescript
// Ottenere tutti i post di un utente usando riferimenti bidirezionali
const cleanup = network.getUserPosts(userPub, (post) => {
  console.log('Post dell\'utente:', post);
});

// Ottenere tutti i tag di un post
const cleanup = network.getPostTags(postId, (tag) => {
  console.log('Tag del post:', tag);
});

// Ottenere tutti i post con un tag specifico
const cleanup = network.getTagPosts('hashtag', (post) => {
  console.log('Post con tag:', post);
});

// Ottenere l'autore di un post
network.getPostAuthor(postId, (profile) => {
  console.log('Autore:', profile);
});

// Ottenere il post parent di una risposta
network.getParentPost(replyId, (post) => {
  console.log('Post originale:', post);
});
```

#### Utilizzo nel Frontend

I metodi sono disponibili tramite l'hook `useSocialProtocol`:

```typescript
const { 
  getPostTags,      // ✅ Usato in PostCard per mostrare i tag
  getParentPost,    // ✅ Usato in PostDetail per mostrare il post originale
  getTagPosts,      // ✅ Usato internamente da viewHashtag
  getUserPosts,     // ✅ Disponibile - vedi useUserPostsBidirectional hook
  getPostAuthor     // ✅ Usato in PostDetail e PostCard per ottenere l'autore
} = useSocialProtocol();
```

**Utilizzo attuale**:
- ✅ `getPostTags` - Usato in `PostCard.tsx` per mostrare i tag di ogni post
- ✅ `getParentPost` - Usato in `PostDetail.tsx` per mostrare il post originale di una risposta
- ✅ `getTagPosts` - Usato internamente da `viewHashtag` (ricerca hashtag usa riferimenti bidirezionali)
- ✅ `getPostAuthor` - Usato in `PostDetail.tsx` e `PostCard.tsx` per ottenere l'autore usando riferimenti bidirezionali
- ✅ `getUserPosts` - Disponibile tramite hook `useUserPostsBidirectional` per casi semplici (senza repost)

**Hook alternativo**: `useUserPostsBidirectional`
Per casi semplici dove non servono i repost, puoi usare:

```typescript
import { useUserPostsBidirectional } from '../hooks/useUserPostsBidirectional';

// Usa i riferimenti bidirezionali per ottenere i post
const { posts, loading } = useUserPostsBidirectional(userPub);
```

**Nota**: `viewHashtag` è stato migliorato per usare internamente `getTagPosts`, quindi ora usa i riferimenti bidirezionali automaticamente.

#### Esempio di Navigazione Complessa (come negli esempi GUN)

```typescript
// Navigare il grafo: User → Posts → Tags → Posts → Comments → Authors
const userNode = gun.user(userPub);
userNode.path('posts').map()           // Tutti i post dell'utente
  .path('tags').map()                  // Tutti i tag dei post
  .path('posts').map()                 // Tutti i post con quei tag
  .path('replies').map()               // Tutte le risposte
  .path('author');                     // Autori delle risposte
```

#### Vantaggi

- **Navigazione efficiente**: Puoi navigare il grafo in entrambe le direzioni
- **Query più veloci**: Accesso diretto alle relazioni senza dover cercare
- **Consistenza**: I riferimenti sono mantenuti automaticamente
- **Pattern GUN standard**: Segue le best practice di GUN per i grafi sociali

## Estensioni Future

### IPFS Integration
Il metodo `uploadMedia` è preparato per l'integrazione IPFS:

```typescript
// Nel file socialProtocol.ts, sostituisci:
async uploadMedia(fileBlob: Blob): Promise<string> {
  // Implementa qui l'upload IPFS reale
  const ipfs = await IPFS.create();
  const result = await ipfs.add(fileBlob);
  return result.cid.toString();
}
```

### Ricerca Avanzata
Aggiungi funzionalità di ricerca:

```typescript
// Esempio futuro
searchPosts(query: string, callback: (post: PostWithAuthor) => void)
searchUsers(query: string, callback: (user: UserProfile) => void)
```

## Best Practices

1. **Sempre fare cleanup dei listener**:
   ```typescript
   useEffect(() => {
     const cleanup = network.viewGlobalTimeline(callback);
     return cleanup; // Importante!
   }, []);
   ```

2. **Usa la cache dei profili**:
   - Il sistema gestisce automaticamente la cache
   - Chiama `clearProfilesCache()` solo se necessario

3. **Gestisci gli errori**:
   ```typescript
   const result = await publishPost('Testo');
   if (!result.success) {
     console.error('Errore:', result.error);
   }
   ```

4. **Ottimizza la timeline**:
   - Carica solo i giorni necessari
   - Implementa paginazione per grandi volumi

## Supporto

Per domande o problemi, consulta:
- Codice sorgente: `src/utils/socialProtocol.ts`
- Hook React: `src/hooks/useSocialProtocol.ts`
- Componente esempio: `src/components/TimelineV2.tsx`

