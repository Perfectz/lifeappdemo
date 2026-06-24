import { createDocumentStore } from "@/data/createDocumentStore";
import { emptyWiki, isPersonalWiki, type PersonalWiki } from "@/domain/personalWiki";

const store = createDocumentStore<PersonalWiki>("lifequest.wiki.v1", isPersonalWiki, emptyWiki);

export const wikiStorageKey = store.storageKey;
export const loadWiki = store.load;
export const saveWiki = store.save;
