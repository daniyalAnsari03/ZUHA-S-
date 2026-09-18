/**
 * Supabase Database types.
 *
 * This is the foundation schema that the application code is typed against.
 * Keep this file in sync with `supabase/migrations/`. As more migrations are
 * added in later phases, regenerate the concrete types with:
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.gen.ts
 *
 * and point the `Database` type below at the generated schema. Keeping the
 * client factory generic across the schema allows this to be swapped without
 * rewriting service code.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "customer" | "admin";
          full_name: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "customer" | "admin";
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "customer" | "admin";
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          fabric: string | null;
          embroidery: string | null;
          color: string | null;
          label: string | null;
          price: number;
          compare_at_price: number | null;
          sku: string | null;
          stock_quantity: number;
          low_stock_threshold: number;
          image_url: string | null;
          is_active: boolean;
          is_featured: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          fabric?: string | null;
          embroidery?: string | null;
          color?: string | null;
          label?: string | null;
          price: number;
          compare_at_price?: number | null;
          sku?: string | null;
          stock_quantity?: number;
          low_stock_threshold?: number;
          image_url?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          fabric?: string | null;
          embroidery?: string | null;
          color?: string | null;
          label?: string | null;
          price?: number;
          compare_at_price?: number | null;
          sku?: string | null;
          stock_quantity?: number;
          low_stock_threshold?: number;
          image_url?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      carts: {
        Row: {
          id: string;
          user_id: string;
          status: "active" | "converted";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: "active" | "converted";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: "active" | "converted";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          product_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_content: {
        Row: {
          id: string;
          key: string;
          value: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          id: string;
          wishlist_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          wishlist_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          wishlist_id?: string;
          product_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          order_number: string;
          status: OrderStatus;
          payment_status: PaymentStatus;
          payment_method: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email: string;
          shipping_address: string;
          city: string;
          postal_code: string | null;
          subtotal: number;
          shipping_fee: number;
          total: number;
          order_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_number: string;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          payment_method?: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email: string;
          shipping_address: string;
          city: string;
          postal_code?: string | null;
          subtotal: number;
          shipping_fee?: number;
          total: number;
          order_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_number?: string;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          payment_method?: string | null;
          customer_name?: string;
          customer_phone?: string;
          customer_email?: string;
          shipping_address?: string;
          city?: string;
          postal_code?: string | null;
          subtotal?: number;
          shipping_fee?: number;
          total?: number;
          order_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          product_price: number;
          product_image: string | null;
          quantity: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          product_price: number;
          product_image?: string | null;
          quantity: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          product_price?: number;
          product_image?: string | null;
          quantity?: number;
          subtotal?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          previous_status: OrderStatus | null;
          new_status: OrderStatus;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          previous_status?: OrderStatus | null;
          new_status: OrderStatus;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          previous_status?: OrderStatus | null;
          new_status?: OrderStatus;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          order_id: string | null;
          type: string;
          title: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id?: string | null;
          type: string;
          title: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_id?: string | null;
          type?: string;
          title?: string;
          message?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          actor_role: "admin" | "customer" | "guest";
          agent_name: string;
          tool_name: string | null;
          action_type: string;
          risk: "low" | "medium" | "high";
          status: "granted" | "denied" | "error";
          entity_type: string | null;
          entity_id: string | null;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          actor_role?: "admin" | "customer" | "guest";
          agent_name: string;
          tool_name?: string | null;
          action_type: string;
          risk: "low" | "medium" | "high";
          status: "granted" | "denied" | "error";
          entity_type?: string | null;
          entity_id?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          actor_role?: "admin" | "customer" | "guest";
          agent_name?: string;
          tool_name?: string | null;
          action_type?: string;
          risk?: "low" | "medium" | "high";
          status?: "granted" | "denied" | "error";
          entity_type?: string | null;
          entity_id?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          channel: "admin" | "salesman";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel: "admin" | "salesman";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          channel?: "admin" | "salesman";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant";
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      guardian_decisions: {
        Row: {
          id: string;
          user_id: string | null;
          actor_role: "admin" | "customer" | "guest";
          agent_name: string;
          tool_name: string | null;
          action_type: string;
          risk: "low" | "medium" | "high";
          decision: "allow" | "deny" | "require_approval";
          reason: string | null;
          target_type: string | null;
          target_id: string | null;
          args: Json;
          approval_required: boolean;
          approval_id: string | null;
          execution_status:
            | "pending"
            | "approved_pending"
            | "executed"
            | "blocked"
            | "failed"
            | "skipped";
          executed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          actor_role?: "admin" | "customer" | "guest";
          agent_name: string;
          tool_name?: string | null;
          action_type: string;
          risk: "low" | "medium" | "high";
          decision: "allow" | "deny" | "require_approval";
          reason?: string | null;
          target_type?: string | null;
          target_id?: string | null;
          args?: Json;
          approval_required?: boolean;
          approval_id?: string | null;
          execution_status?:
            | "pending"
            | "approved_pending"
            | "executed"
            | "blocked"
            | "failed"
            | "skipped";
          executed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          actor_role?: "admin" | "customer" | "guest";
          agent_name?: string;
          tool_name?: string | null;
          action_type?: string;
          risk?: "low" | "medium" | "high";
          decision?: "allow" | "deny" | "require_approval";
          reason?: string | null;
          target_type?: string | null;
          target_id?: string | null;
          args?: Json;
          approval_required?: boolean;
          approval_id?: string | null;
          execution_status?:
            | "pending"
            | "approved_pending"
            | "executed"
            | "blocked"
            | "failed"
            | "skipped";
          executed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      approval_requests: {
        Row: {
          id: string;
          guardian_decision_id: string | null;
          user_id: string | null;
          agent_name: string;
          action_type: string;
          risk: "low" | "medium" | "high";
          target_type: string | null;
          target_id: string | null;
          summary: string;
          execution: Json;
          context_hash: string;
          status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
          requested_at: string;
          decided_by: string | null;
          decided_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: string;
          guardian_decision_id?: string | null;
          user_id?: string | null;
          agent_name: string;
          action_type: string;
          risk?: "low" | "medium" | "high";
          target_type?: string | null;
          target_id?: string | null;
          summary: string;
          execution?: Json;
          context_hash: string;
          status?: "pending" | "approved" | "rejected" | "expired" | "cancelled";
          requested_at?: string;
          decided_by?: string | null;
          decided_at?: string | null;
          expires_at?: string;
        };
        Update: {
          id?: string;
          guardian_decision_id?: string | null;
          user_id?: string | null;
          agent_name?: string;
          action_type?: string;
          risk?: "low" | "medium" | "high";
          target_type?: string | null;
          target_id?: string | null;
          summary?: string;
          execution?: Json;
          context_hash?: string;
          status?: "pending" | "approved" | "rejected" | "expired" | "cancelled";
          decided_by?: string | null;
          decided_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      whatsapp_settings: {
        Row: {
          id: boolean;
          phone_number_id: string | null;
          display_phone: string | null;
          business_name: string | null;
          require_approval_for_send: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          phone_number_id?: string | null;
          display_phone?: string | null;
          business_name?: string | null;
          require_approval_for_send?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          phone_number_id?: string | null;
          display_phone?: string | null;
          business_name?: string | null;
          require_approval_for_send?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_recipients: {
        Row: {
          id: string;
          label: string;
          phone: string;
          recipient_type: "admin" | "customer";
          user_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          phone: string;
          recipient_type?: "admin" | "customer";
          user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          phone?: string;
          recipient_type?: "admin" | "customer";
          user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_messages: {
        Row: {
          id: string;
          idempotency_key: string;
          provider_message_id: string | null;
          recipient_phone: string;
          recipient_label: string | null;
          content: string;
          message_type: "text";
          direction: "inbound" | "outbound";
          sender_phone: string | null;
          status: "queued" | "sent" | "delivered" | "read" | "failed" | "rejected";
          provider_status: string | null;
          error_code: string | null;
          error_message: string | null;
          requested_by_user_id: string | null;
          guardian_decision_id: string | null;
          created_at: string;
          sent_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          idempotency_key: string;
          provider_message_id?: string | null;
          recipient_phone: string;
          recipient_label?: string | null;
          content?: string;
          message_type?: "text";
          direction?: "inbound" | "outbound";
          sender_phone?: string | null;
          status?: "queued" | "sent" | "delivered" | "read" | "failed" | "rejected";
          provider_status?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          requested_by_user_id?: string | null;
          guardian_decision_id?: string | null;
          created_at?: string;
          sent_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          idempotency_key?: string;
          provider_message_id?: string | null;
          recipient_phone?: string;
          recipient_label?: string | null;
          content?: string;
          message_type?: "text";
          direction?: "inbound" | "outbound";
          sender_phone?: string | null;
          status?: "queued" | "sent" | "delivered" | "read" | "failed" | "rejected";
          provider_status?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          requested_by_user_id?: string | null;
          guardian_decision_id?: string | null;
          created_at?: string;
          sent_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_webhook_events: {
        Row: {
          id: string;
          provider_event_id: string;
          event_type: "message" | "status" | "unknown";
          status: "received" | "processed" | "ignored" | "failed" | "duplicate";
          phone_number_id: string | null;
          sender_phone: string | null;
          payload: Json;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          provider_event_id: string;
          event_type?: "message" | "status" | "unknown";
          status?: "received" | "processed" | "ignored" | "failed" | "duplicate";
          phone_number_id?: string | null;
          sender_phone?: string | null;
          payload?: Json;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          provider_event_id?: string;
          event_type?: "message" | "status" | "unknown";
          status?: "received" | "processed" | "ignored" | "failed" | "duplicate";
          phone_number_id?: string | null;
          sender_phone?: string | null;
          payload?: Json;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: { uid: string };
        Returns: boolean;
      };
      generate_order_number: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
