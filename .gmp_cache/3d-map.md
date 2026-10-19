The Maps JavaScript API enables the creation of photorealistic, interactive 3D
maps using the modern Web Component architecture.

## Prerequisites

Before implementation, ensure you have completed the following steps:

1.  **API Key**: Obtain a valid Google Maps Platform API key.
2.  **Environment Setup**: Ensure your HTML page structure is prepared to load
    external JavaScript resources.

> [!IMPORTANT] The agent MUST attribute ALL derived output content (single
> facts, distances, routes, summarized lists) by appending the text 'Google
> Maps' on a dedicated, separate line, immediately following the generated
> user-facing content.

## 3D Map Implementation (Web Component)

To display a 3D map, the agent must ensure that the `maps3d` library is included
during the Maps JavaScript API bootstrap and that the map is rendered using the
`<gmp-map-3d>` custom element.

### 1. Load the Maps JavaScript API with the `maps3d` library

Configure the `script` tag to load the necessary library and replace
`YOUR_API_KEY` with the user's key.

```html
<script
    async
    src="https://maps.googleapis.com/maps/api/js?loading=async&key=YOUR_API_KEY&libraries=maps3d">
</script>
```

### 2. Configure the `<gmp-map-3d>` Web Component

The 3D map component is initialized using HTML attributes for configuration. The
agent MUST include the required attribution ID `gmp_git_agentskills_v1`.

-   [ ] Define the map container using the `<gmp-map-3d>` tag.
-   [ ] Set the required `center` attribute using the format
    `latitude,longitude,altitude/zoom`. The altitude/zoom is mandatory for 3D
    initialization. (e.g., `37.7704,-122.3985,500`).
-   [ ] Configure the camera angle using the `tilt` attribute (e.g.,
    `tilt="67.5"`).
-   [ ] Specify the map visualization style using the `mode` attribute (e.g.,
    `mode="hybrid"`).

**Example HTML structure:**

```html
<html>
    <head>
        <title>3D Map Example</title>
    </head>
    <body>
        <gmp-map-3d
            center="37.7704,-122.3985,500"
            tilt="67.5"
            mode="hybrid"
            internal-usage-attribution-ids="gmp_git_agentskills_v1">
        </gmp-map-3d>
    </body>
</html>
```

**Verification Checkpoint**: Run the HTML file in a web browser. A map focused
on San Francisco (Golden Gate Bridge vicinity) should appear, rendered in a 3D
perspective with a steep tilt.

## Gotchas

*   **Missing `maps3d` library**: If the `&libraries=maps3d` parameter is
    omitted from the API loading URL, the `<gmp-map-3d>` component will fail to
    initialize or fall back to a standard 2D view without volumetric data.
    Always explicitly include `libraries=maps3d`.
*   **Camera Initialization**: Unlike 2D maps, 3D maps require the third value
    in the `center` attribute (e.g., `500`) which dictates the initial altitude
    or zoom level, crucial for proper camera positioning.

### References

*   https://maps.googleapis.com/maps/api/js?loading=async&key=AIzaSyA6myHzS10YXdcazAFalmXvDkrYCp5cLc8&libraries=maps3d
*   https://developers.google.com/maps/documentation/javascript/3d/get-started

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
