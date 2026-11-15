# Studio redesign: how it should look and feel

What Emile described on Nov 13 for the new design of the dashboard, written up as a design brief.

## 1. The space: a cosy Manhattan studio, not a penthouse

A studio apartment in Manhattan with classic exposed brick walls. Smaller and more compact than the penthouse, very cosy, artsy, and lived-in, like a real home.

- **Shell:**
  - One compact room (roughly 7 x 9 m).
  - Exposed red brick walls with real mortar depth, slightly uneven.
  - One plaster wall.
  - Tall black steel factory windows, with a fire escape outside and the city at dusk or night behind it.
  - Wide-plank worn oak floor, and a cast-iron radiator under the window.
- **Light:**
  - Warm and layered, never flat: Edison bulb pendants, a brass floor lamp, a desk lamp, string lights along the brick, candles, and streetlight through the window.
  - Each corner gets its own pool of light, so every room reads at a glance.
- **Bedroom corner:** a low bed with rumpled linen and a chunky knit throw, a bookshelf as a divider, and framed prints above the bed.
- **Kitchen corner:** a small galley with open wooden shelves, white subway tiles, a moka pot and a fruit bowl, plus a small round bistro table with two chairs.
- **Office corner:** a wooden desk by the window, a monitor and laptop, a vintage task lamp, and a pinboard with notes.
- **Gym corner:**
  - A bench and a dumbbell rack.
  - A pull-up bar in a door frame.
  - A yoga mat, and a mirror leaning against the brick.
- **Artsy details:**
  - A gallery wall of mixed frames and posters.
  - A record player with a vinyl shelf, and stacks of books.
  - Plants: trailing pothos and a big monstera.
  - A kilim or Persian rug and a leather armchair.
  - Ceramics, and a guitar or an easel.
- **Performance:** it has to stay fast: 50+ fps on a MacBook Air.

## 2. Characters

The current characters look too fake. Each one gets a custom set of clothes that fits their room:

- **Kitchen and home:** at-home clothes. Grey sweatpants, an oversized hoodie with the hood up, socks and slides.
- **Office:** a suit. Tailored charcoal or navy, a white shirt, loafers.
- **Gym:** workout clothes. Shorts over tights, a fitted training tee, trainers, headphones around the neck.
- **Bedroom:** soft loungewear.

They should move around the studio a bit, not just loop in place.

**Style options to choose from.** A test page could show all four characters in each style side by side:

- **A. Soft clay:** smooth, matte, slightly chunky, simple dot-eye faces. Cosy, and fits the brick.
- **B. Low-poly:** faceted and flat-shaded, with a small colour palette. Crisp and very fast.
- **C. Realistic proportions:** rigged models from a free character pack, with real walk and idle animations. The least fake, but the heaviest to run.
- **D. Editorial mannequins:** faceless, one skin tone, tall fashion-illustration proportions, so the clothes do the talking.

## 3. Motion and smoothness

- **Less laggy.** Today, clicking Office first zooms out and then zooms in. It should be one steady camera move straight into the room.
- **Smooth clicks and scrolling everywhere:**
  - Pages load ahead of time, so clicking feels instant.
  - Loading placeholders instead of blank screens.
  - Short, consistent transitions on tabs and cards.
  - Normal scrolling, with no scroll-jacking.
- **More freedom and flexibility in the UI overall.**

## 4. Opening a room: straight to a full-screen page

- No sidebar. Today a room fills about three quarters of the screen with the 3D scene and squeezes the data into a side panel. Emile doesn't want that.
- Clicking a room should go straight to a full-screen page where everything is visible at a glance. There's no need to scroll down first to reach the "full view".
- **Keep the "rise into the night sky" transition** (camera goes up, page slides over it). They like it. It should just happen automatically after the click, so you land on the full page right away.
- Esc or a back button returns to the studio.

## 5. The room pages: organized, like a real website

All four pages share one clean, organized design that looks like a proper product, aesthetic but efficient:

- A top bar with a room switcher.
- Tabs inside each room.
- Cards that fit on one screen, without much scrolling.

**Office**
- A proper calendar view, like Google or Apple Calendar.
- A to-do list next to it that is actually filled from their inbox (deadlines, people waiting on them).
- No Jobs tab and no weekly application goal.

**Kitchen**
- **Fridge:** everything visible at once, concise, no scrolling to find what's in it.
- **Budget:** on its own tab.
- **Recommended meals:** a list based on what's in the fridge. Portions decently big, with plenty of protein.
- **Claude chat:** ask what to make, and log what you cooked.
- **Saved meals:** one-tap logging for regular meals, e.g. the everyday breakfast of 4 eggs with avocado on toast.
- **Meal preps:** logged with portions left, e.g. the poke bowl meal prep.

**Gym**
- Already the room with the most data, but it should be compact and split into tabs instead of one long page: overview, lifts, volume, history.
- Look like a professional dashboard.
- A chat box to ask Claude about training.

**Bedroom**
- Sleep, shown honestly as sample data until a real source is connected.

## 6. Name

"Penthouse" no longer fits a studio. Options: **Walk-up, Apt 4B, Hearth, The Studio, Home Base.**
