import firebase_admin
from firebase_admin import credentials, firestore, auth

# 1. Configure these for your project
SERVICE_ACCOUNT_PATH = "/Users/shrey/Desktop/pocs/doctustech/backend/creds/doctustech-489510-8b983a220391.json"
FIREBASE_PROJECT_ID = "doctustech-489510"

# Map of orgSlug -> users (these emails must already exist in Firebase Auth)
SEED_DATA = {
    "acme": {
        "name": "Acme Inc",
        "users": [
            {"email": "sarah@acme.com", "displayName": "Sarah", "role": "admin"},
            {"email": "mike@acme.com", "displayName": "Mike", "role": "member"},
            {"email": "lisa@acme.com", "displayName": "Lisa", "role": "member"},
        ],
    },
    "globex": {
        "name": "Globex Corp",
        "users": [
            {"email": "alice@globex.com", "displayName": "Alice", "role": "admin"},
            {"email": "bob@globex.com", "displayName": "Bob", "role": "member"},
            {"email": "eve@globex.com", "displayName": "Eve", "role": "member"},
        ],
    },
}


def main():
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})
    db = firestore.client()

    for org_slug, org_info in SEED_DATA.items():

        # organizations/{orgSlug}
        org_ref = db.collection("organizations").document(org_slug)
        org_ref.set(
            {
                "slug": org_slug,
                "name": org_info["name"],
            },
            merge=True,
        )

        # Create users in org subcollection and set custom claims
        users_collection = org_ref.collection("users")
        user_ids = []

        for u in org_info["users"]:
            # Look up existing Auth user by email
            user_record = auth.get_user_by_email(u["email"])
            uid = user_record.uid
            user_ids.append(uid)

            # organizations/{orgSlug}/users/{uid}
            users_collection.document(uid).set(
                {
                    "uid": uid,
                    "email": u["email"],
                    "displayName": u["displayName"],
                    "role": u["role"],  # "admin" | "member"
                },
                merge=True,
            )

            # Set custom claims for multi-tenancy
            # WARNING: this overwrites existing custom claims; merge if needed.
            auth.set_custom_user_claims(uid, {"orgSlug": org_slug})

        # Create a couple of rooms
        rooms_collection = org_ref.collection("rooms")

        engineering_room_ref = rooms_collection.document("engineering")
        engineering_room_ref.set(
            {
                "name": "engineering",
                "description": "Engineering discussions",
                "memberIds": user_ids,
            },
            merge=True,
        )

        general_room_ref = rooms_collection.document("general")
        general_room_ref.set(
            {
                "name": "general",
                "description": "General team chat",
                "memberIds": user_ids,
            },
            merge=True,
        )

        # Seed some messages in engineering room
        messages_collection = engineering_room_ref.collection("messages")

        # Simple helper
        def add_message(sender_email, content):
            sender = next(
                u for u in org_info["users"] if u["email"] == sender_email
            )
            user_record = auth.get_user_by_email(sender_email)
            messages_collection.add(
                {
                    "senderId": user_record.uid,
                    "senderName": sender["displayName"],
                    "senderRole": sender["role"],
                    "type": "user",
                    "content": content,
                    "createdAt": firestore.SERVER_TIMESTAMP,
                }
            )

        if org_slug == "acme":
            add_message("sarah@acme.com", "We need to decide on the caching strategy for our API.")
            add_message("mike@acme.com", "I'm thinking Redis, but worried about costs at scale.")
            add_message("lisa@acme.com", "We're already on GCP, should we consider Memorystore?")
            add_message("sarah@acme.com", "@Gemini what do you recommend?")



if __name__ == "__main__":
    main()