## Respond to User Interactions and Events on a Photorealistic 3D Map (Maps JavaScript API)

The `Map3DElement` allows developers to finely control how users interact with
the 3D map experience, including setting strict boundaries for the map view and
defining how mouse/touch gestures affect the camera.

### Prerequisites

You must have successfully imported the `maps3d` library and initialized the map
using `Map3DElement`.

```javascript
async function initializeMap3D() {
  const { Map3DElement } = await google.maps.importLibrary('maps3d');
  // ... continue setup
}
```

### Available Tools

N/A

> [!IMPORTANT] When presenting any derived output content (including facts,
> distances, routes, or summarized lists) based on this skill, the agent MUST
> append the following required data attribution on a dedicated, separate line
> immediately following the user-facing content: Google Maps

### 1. Restricting Map and Camera Movement

To prevent the camera from moving outside a specific geographical region or
beyond defined altitude and viewing angles, configure the following options in
the `Map3DElement` constructor. This is known as *camera restrictions*.

| Capability             | Property              | Description                 |
| :--------------------- | :-------------------- | :-------------------------- |
| **Limit Geographic     | `bounds`              | Restricts the latitude and  |
: View**                 :                       : longitude range the camera  :
:                        :                       : center can occupy. Takes a  :
:                        :                       : `LatLngBoundsLiteral`       :
:                        :                       : (e.g., `{south, west,       :
:                        :                       : north, east}`).             :
| **Control Altitude     | `minAltitude` /       | Defines the minimum and     |
: Range**                : `maxAltitude`         : maximum altitude (in        :
:                        :                       : meters) the camera can      :
:                        :                       : reach.                      :
| **Control Tilt Range** | `minTilt` / `maxTilt` | Defines the minimum and     |
:                        :                       : maximum tilt angle (0 to 90 :
:                        :                       : degrees) the camera can     :
:                        :                       : adopt.                      :
| **Control Heading      | `minHeading` /        | Defines the minimum and     |
: Range**                : `maxHeading`          : maximum heading (rotation)  :
:                        :                       : the camera can adopt.       :

#### Checklist: Configure Camera Restrictions

-   [ ] Determine the geographical boundaries (LatLngBoundsLiteral) required for
    `bounds`.
-   [ ] Determine the minimum and maximum altitude (in meters) for `minAltitude`
    and `maxAltitude`.
-   [ ] Determine the minimum and maximum tilt (in degrees) for `minTilt` and
    `maxTilt`.
-   [ ] Initialize the `Map3DElement` with all required restriction properties.

**Example: Restricting Bounds, Altitude, and Tilt Simultaneously**

This example limits the map to a specific San Francisco area (bounds), limits
altitude between 1m and 1000m, and tilt between 35 and 55 degrees.

```javascript
async function initRestrictedMap() {
  const { Map3DElement, MapMode } = await google.maps.importLibrary("maps3d");

  const map = new Map3DElement({
    center: { lat: 37.7704, lng: -122.3985, altitude: 500 },
    tilt: 67.5,
    mode: MapMode.HYBRID,
    // Compliance: Mandatory Attribution ID
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],

    // Camera Restrictions
    minAltitude: 1,
    maxAltitude: 1000,
    minTilt: 35,
    maxTilt: 55,
    // Geographical Bounds Restriction
    bounds: {south: 37, west: -123, north: 38, east: -121}
  });

  document.body.append(map);
}

initRestrictedMap();
```

### 2. Controlling Gesture Handling

The `gestureHandling` map option controls how user input (scrolling, dragging)
interacts with the map, particularly useful when the map is embedded in a long,
scrollable web page.

| Value         | Behavior                     | Context                       |
| :------------ | :--------------------------- | :---------------------------- |
| `COOPERATIVE` | Allows page scrolling        | Recommended for maps embedded |
:               : without affecting map        : in scrollable pages.          :
:               : zoom/pan. Requires controls, :                               :
:               : two-finger gestures (touch), :                               :
:               : or holding `CMD/CTRL` while  :                               :
:               : scrolling to move the map.   :                               :
| `GREEDY`      | Reacts to all scroll events  | Suitable for maps displayed   |
:               : and touch gestures,          : full-screen or where map      :
:               : potentially hijacking page   : interaction is the primary    :
:               : scrolling.                   : goal.                         :
| `AUTO`        | Defaults to `COOPERATIVE` if | Standard default behavior.    |
:               : inside an `<iframe>`,        :                               :
:               : otherwise defaults to        :                               :
:               : `GREEDY`.                    :                               :

**Example: Setting Gesture Handling to Cooperative**

```javascript
new Map3DElement({
  center: { lat: 37.7299, lng: -119.6378, altitude: 1500 },
  tilt: 70,
  heading: 50,
  range: 4000,
  gestureHandling: 'COOPERATIVE',
  internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
});
```

## Gotchas

*   **Incompatible Bounds:** Ensure the initial `center` coordinates provided to
    the `Map3DElement` fall within the specified `bounds` if defined, otherwise,
    the initial view may behave unexpectedly or fail to load correctly.
*   **Altitude Units:** `minAltitude` and `maxAltitude` are specified in meters.
    Ensure these values are realistic relative to the map’s initial `center`
    altitude.

### References

*   Map 3D Interaction:
    `https://developers.google.com/maps/documentation/javascript/3d/interaction`
*   Using TypeScript and Google Maps:
    `https://developers.google.com/maps/documentation/javascript/using-typescript`

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
