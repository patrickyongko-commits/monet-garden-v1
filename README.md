# MONET GARDEN V2 – Reference Image Paste Fixed

This version supports Ctrl+V screenshot/reference-image paste and fixes the save/display flow.

## Important: run the storage SQL once
Open Supabase SQL Editor and run **supabase-order-upgrade.sql** from this package.

It will:
- create/ensure the `order-references` storage bucket
- make the bucket public so saved reference-image URLs can be displayed
- allow authenticated staff to upload, read, update and delete reference images
- ensure `orders.reference_image_url` exists

## Reference Image workflow
1. Open New Order or Edit Order.
2. Click inside the Reference Image area.
3. Press Ctrl+V after copying a screenshot/image.
4. Save the order.
5. The image is uploaded to Supabase Storage and its public URL is saved in `orders.reference_image_url`.
6. Orders, Dashboard and Edit Order can then display the saved image.

If storage is not configured, the app now shows the actual upload error instead of silently saving an order with a missing reference image.
