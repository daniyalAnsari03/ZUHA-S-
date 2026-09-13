# Phase 7 AI Runtime Fix — Summary

## Root Cause

The OpenAI Agents SDK converts `handoffs` array entries into **tools the model can call**. The model was generating TEXT about transferring (e.g., "Sales team ko transfer kar raha hoon.") instead of calling the actual SDK handoff tools. This caused the SDK to treat the output as final text and never switch to the specialist agent.

## Changes Made

### 1. `agents/employees.ts`
Added `handoffDescription` to all 7 employee agents:
- `productAgent` — "Handles product catalog operations: list all products, search by name/SKU/category, create, update, publish/unpublish, delete products, and resolve categories."
- `inventoryAgent` — "Handles inventory and stock operations: update stock quantities, list low-stock products, search products by name/SKU for inventory changes."
- `orderAgent` — "Handles order management: list all orders by status, view order details, update order status, and answer delivery/shipping questions."
- `customerAgent` — "Handles customer record management: list all customers, search customers by name/phone/city, view individual customer profiles and order history."
- `salesAgent` — "Handles sales analytics and business intelligence: today's sales, weekly/monthly revenue, order counts, top-selling products, sales trends, and low-stock inventory reports."
- `marketingAgent` — "Handles marketing content generation: product marketing copy, social media posts with hashtags, and ad copy for paid campaigns."
- `supportAgent` — "Handles read-only customer support: looks up customer records, orders, product availability, and store policies."

### 2. `agents/manager.ts`
- Added `handoffDescription` to `managerAgent`
- Rewrote `ADMIN_INSTRUCTIONS` with explicit section "CRITICAL — HOW TO ROUTE":
  - "You have no tools of your own. You route requests to specialist employees by CALLING THE HANDOFF TOOL."
  - "Do NOT output text like 'Sales team ko transfer kar raha hoon.' and stop. You MUST call the actual handoff tool."
  - Added route table with exact handoff tool call names (e.g., `transfer_to_product`, `transfer_to_sales`)

### 3. `agents/salesman.ts`
- Added `handoffDescription` to `salesmanAgent`
- Added new section "CRITICAL — HOW TO HANDLE SUPPORT REQUESTS":
  - "You have a handoff tool called transfer_to_support. When the customer needs help beyond your catalog/order capabilities, you MUST call the transfer_to_support handoff tool — do NOT just say 'a support team member will assist'."

### 4. `tests/unit/ai/phase7-integration.test.ts`
Fixed typo: `PRODUCTS/CREAT/EDIT` → `PRODUCTS/CREATE/EDIT`

## Execution Chain Verified

```
User Message (e.g., "aaj ki sales batao")
    ↓
API Route (/api/ai/admin/route.ts)
    ↓ getAuthUser() → admin role verified
    ↓
runChatTurn (lib/ai/run-turn.ts)
    ↓ creates AgentContext { userId, role, channel }
    ↓
SDK Runner.run(entryAgent, inputItems, { context })
    ↓
Manager Agent (agents/manager.ts)
    ↓ receives message
    ↓ calls handoff tool (e.g., transfer_to_sales)
    ↓
Sales Agent (agents/employees.ts)
    ↓ receives request
    ↓ calls get_sales_overview tool
    ↓
toolRoleGuardrail (guardians/authorization.ts)
    ↓ checks context.role === "admin"
    ↓ allows tool execution
    ↓
getSalesOverview tool (tools/analytics.ts)
    ↓ calls getSalesAnalytics() service
    ↓ queries Supabase
    ↓ returns real data
    ↓
Sales Agent interprets result
    ↓
Final response generated with real sales data
```

## Test Results

- ✅ All 209 unit tests pass
- ✅ TypeScript type check passes
- ✅ No new lint errors from changes

## Agent → Tool Mapping

### Manager Agent
- No tools (routes via handoffs only)
- Handoffs: product, inventory, order, customer, sales, marketing, support

### Product Agent
- Tools: list_products, get_product, search_products_admin, resolve_category_id, create_product, update_product, set_product_active, delete_product, list_categories, get_cms

### Inventory Agent
- Tools: list_products, get_product, search_products_admin, update_stock, list_low_stock_products

### Order Agent
- Tools: list_all_orders, get_order_detail, update_order_status, get_cms

### Customer Agent
- Tools: list_customers, get_customer_detail

### Sales Agent
- Tools: get_sales_overview, list_products, list_all_orders, list_low_stock_products

### Marketing Agent
- Tools: get_sales_overview, list_products, list_low_stock_products, list_all_orders, get_cms, generate_product_marketing_copy, generate_social_post, generate_ad_copy

### Support Agent
- Tools: list_customers, get_customer_detail, list_all_orders, get_order_detail, list_products, get_product, search_products_admin, get_cms, check_availability

### Salesman Agent (Customer-facing)
- Tools: list_categories, list_products, get_product, check_availability, get_cms, list_my_orders, get_my_order
- Handoffs: support

## Authorization Path

1. `toolRoleGuardrail` checks `context.role` against allowed roles
2. If role is not allowed → returns `rejectContent` (tool never executes)
3. If role is allowed → tool executes with `adminActor` or `customerActor`
4. Actor is passed to service layer for RLS enforcement

## Database/Service Path

All tools call actual Supabase services:
- `getSalesAnalytics()` → queries orders, customers, products
- `listActiveProducts()` → queries products with RLS
- `listAllOrders()` → queries orders with RLS
- `listCustomers()` → queries customers with RLS
- `updateStock()` → updates product stock with verification
- etc.

## Remaining Work

1. **Manual QA Testing** — Run the app locally and test the 15 QA scenarios from `docs/fix.txt`
2. **Verify Customer AI** — Test customer-facing flows (search, add to cart, checkout)
3. **Commit Changes** — Once QA passes, commit and push to GitHub
4. **Deploy to Vercel** — Deploy production and verify

## Files Changed

- `agents/employees.ts` — added handoffDescription to all 7 employees
- `agents/manager.ts` — rewrote ADMIN_INSTRUCTIONS with explicit handoff routing
- `agents/salesman.ts` — updated CUSTOMER_INSTRUCTIONS with explicit support handoff
- `tests/unit/ai/phase7-integration.test.ts` — fixed typo
