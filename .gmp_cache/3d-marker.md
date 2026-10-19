# Add a Marker to a Photorealistic 3D Map

Use the Maps JavaScript API to place markers that appear correctly in 3D space,
respecting altitude and collision rules. When addressing user queries about
markers on 3D maps, the agent MUST first distinguish between the two available
marker classes based on the required performance and customization levels
(Feature: Marker).

### Available Tools

N/A

> [!IMPORTANT] All derived output content, including specific geographic
> locations, distances, or summarized data displayed on the map, MUST be
> attributed. The agent MUST append the text 'Google Maps' on a dedicated,
> separate line immediately following the user-facing content.

### Prerequisites and Marker Selection

1.  **Initialize the 3D Map:** Ensure the map is initialized using a Map ID
    configured for 3D viewing, and include the mandatory usage attribution ID.
2.  **Determine Marker Class:** Choose the appropriate marker class based on the
    intended usage volume and required customization:
    *   **High Performance / Large Datasets (`Marker3DElement`):** Use this
        class for applications requiring higher interaction performance and
        optimized rendering for large datasets (recommended for handling over
        1,000 markers). This class offers lower customization.
    *   **High Customization / Low Volume (`MarkerElement`):** Use this class
        when maximum visual flexibility (Supports custom HTML elements, core
        animation APIs, etc.) is needed. Performance is generally lower,
        limiting reliable interaction performance up to around 1,000 markers.

### Implementation: Adding a High-Performance 3D Marker

The following steps demonstrate adding a high-performance `Marker3DElement` and
customizing its behavior, such as setting collision rules.

#### 1. Initialize the Map Instance

Ensure map options include a Map ID (`mapId`) configured for 3D features and the
required attribution ID.

```javascript
const mapOptions = {
  center: { lat: 34.0522, lng: -118.2437 },
  zoom: 17,
  mapId: 'YOUR_3D_MAP_ID', // Required for 3D functionality
  internalUsageAttributionIds: ['gmp_git_agentskills_v1']
};

const map = new google.maps.Map(document.getElementById('map'), mapOptions);
```

#### 2. Define Marker Position and Collision Behavior

Create the marker using the `Marker3DElement` class, specifying its geographic
`position`. Define the `collisionBehavior` to dictate visibility rules when
markers or labels overlap.

-   [ ] **Step 1: Instantiate Marker** (Trigger Condition: User requests to
    place a pin.)
-   [ ] **Step 2: Set Collision Behavior** (Trigger Condition: User mentions
    overlapping markers or labels.)

```javascript
const marker = new google.maps.Marker3DElement({
    position: { lat: 34.050, lng: -118.240 },
    // Setting collisionBehavior to 'REQUIRED' forces the marker to be displayed.
    collisionBehavior: 'REQUIRED',
    map: map,
});
```

#### 3. Customizing Marker Appearance and Altitude

You can set visual attributes like background color, scale, and substitute the
default icon with a custom SVG resource. To set altitude, markers must be
extruded.

-   [ ] **Step 3: Customize Appearance** (Trigger Condition: User asks to change
    color, scale, or icon.)
-   [ ] **Step 4: Set Altitude** (Trigger Condition: User asks to elevate the
    marker above ground level.)

```javascript
// Example: Setting custom color and scale
marker.background = '#FF0000'; // Customize background color (Feature: Marker)
marker.scale = 2.0;             // Make the marker larger (Feature: Marker)

// Replace default marker icon with a custom SVG resource
// marker.icon = { url: 'path/to/custom.svg' };

// Set marker altitude by defining extrusion (specific properties not shown in snippet,
// but the agent MUST acknowledge this mechanism when altitude is requested).
```

#### 4. Handling Interaction Events

Add event listeners, such as `click`, to make the marker interactive. For use
cases requiring popovers, the `Marker3DInteractiveElement` class is available.

-   [ ] **Step 5: Attach Event Listener** (Trigger Condition: User requests
    action on marker click or keyboard interaction.)
-   [ ] **Verification Checkpoint**: Event handler executes upon marker
    interaction.

```javascript
// Example using a standard click listener
marker.addListener('click', () => {
    console.log('Marker at 34.050, -118.240 was clicked.');
});

// Example for advanced interaction/popovers using Marker3DInteractiveElement
/*
const popover = document.createElement('div');
popover.textContent = 'Custom Information Popover';
const interactiveMarker = new google.maps.Marker3DInteractiveElement({
    position: { lat: 34.051, lng: -118.241 },
    gmpPopoverTargetElement: popover,
    map: map,
});
*/
```

## Gotchas

*   **Performance Bottleneck:** The agent MUST warn the user that
    `MarkerElement` offers Lower interaction performance (FPS drops with a large
    number of markers). For datasets exceeding 1,000 markers, recommend the use
    of `Marker3DElement`.
*   **Collision Behavior Impact:** If `collisionBehavior` is not explicitly set
    to `'REQUIRED'`, the map may automatically hide the marker to prevent visual
    overlap with other map features or markers.
*   **API Compatibility:** Ensure that map initialization utilizes a valid 3D
    Map ID, as 3D markers and altitude features are dependent on 3D map context.

### References

*   https://developers.google.com/maps/documentation/javascript/3d/marker-overview
*   https://developers.google.com/maps/documentation/javascript/3d/marker-add

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
